const mongoose = require("mongoose");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");
const Conversation = require("../models/Conversation");
const PDFDocument = require("pdfkit");
const File = require("../models/File");

exports.saveConversationToFile = async (req, res) => {
  console.log("saving file...");
  try {
    const loadedUser = await User.find({ ID: req.body.userID });

    if (!loadedUser) {
      return res.status(404).json("User not found");
    }

    const loadedConversation = await Conversation.findOne({
      conversationID: req.body.conversationID,
      "user.ID": req.body.userID,
    });

    if (!loadedConversation) {
      return res.status(401).json("Conversation not found");
    }

    const questions = loadedConversation.questions || [];
    const answers = loadedConversation.answers || [];
    const introduction = req.body.introduction;

    const fileType = req.body.fileType;

    if (fileType === "txt") {
      console.log("working with txt");
      const fileName = `${req.body.title}.txt`;
      const dirPath = path.join(__dirname, `../libary/${req.body.userID}`);
      const filePath = path.join(dirPath, fileName);

      // Create directory if it doesn't exist
      await fs.promises.mkdir(dirPath, { recursive: true }); // Use promises version of mkdir

      // Write conversation content to the txt file
      const uploadFile = await handleTxt(
        introduction,
        filePath,
        questions,
        answers
      );
      console.log(filePath);

      const fileID = new mongoose.Types.ObjectId();

      if (uploadFile) {
        // Save file details to the database
        const newFile = new File({
          userID: req.body.userID,
          fileID: fileID,
          fileName: fileName,
          link: filePath,
          chatIndicator: true,
        });
        await newFile.save();
      } else {
        return res
          .status(500)
          .json({ message: "TXT file not created successfully", filePath });
      }
    } else {
      const fileName = `${req.body.title}.pdf`;
      const dirPath = path.join(__dirname, `../libary/${req.body.userID}`);
      const filePath = path.join(dirPath, fileName);

      const uploadFile = await handlePdf(
        introduction,
        filePath,
        questions,
        answers
      );
      const fileID = new mongoose.Types.ObjectId();

      if (uploadFile) {
        const newFile = new File({
          userID: req.body.userID,
          fileID: fileID,
          fileName: fileName,
          link: filePath,
          chatIndicator: true,
        });
        await newFile.save();

        return res
          .status(200)
          .json({ message: "PDF created successfully", filePath });
      } else {
        console.error("PDF stream error:", err);
        return res.status(500).json("Failed to save PDF");
      }
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json("Fail");
  }
};

exports.getFiles = async (req, res) => {
  // console.log("bringing files");
  const userID = req.body.userID;

  if (!userID) {
    return res.status(400).json("userID not sented");
  }

  const loadedUser = await User.find({ ID: userID });

  if (!loadedUser) {
    return res.status(404).json("user not found");
  }
  try {
    const files = await File.find({ userID: userID });
    const fs = require("fs");

    if (!files) {
      return res.stats(404).json("files not found for this user");
    }

    const fileData = [];

    for (const file of files) {
      const { fileID, fileName, link, chatIndicator } = file;
      // console.log(link);

      const stats = await fs.promises.stat(link);
      let fileSize = (stats.size / (1024 * 1024)).toFixed(2);
      fileSize = Math.max(fileSize, 0.1);
      const fileType = path.extname(fileName).toLowerCase();

      fileData.push({
        id: fileID,
        name: fileName,
        size: fileSize,
        type: fileType,
        chatIndicator: chatIndicator,
      });
    }
    return res.status(200).json(fileData);
  } catch (err) {
    console.log(err);
    return res.status(500).json("internal error");
  }
};

exports.getFile = async (req, res) => {
  const fileID = req.body.fileID;
  const userID = req.body.userID;

  const loadedFileObj = await File.find({ userID: userID, fileID: fileID });

  if (!loadedFileObj) {
    return res.status(404).json("file not found");
  }
  try {
  } catch {}
};

exports.deleteFile = async (req, res) => {
  console.log("deleting file");
  const fileID = req.body.fileID;
  const userID = req.body.userID;

  try {
    const loadedFile = await File.find({ userID: userID, fileID: fileID });

    if (!loadedFile) {
      return res.status(404).json("flie not found");
    }

    console.log(loadedFile[0].link);

    fs.unlink(loadedFile[0].link, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json("internal server error");
      }
      console.log("File deleted successfully");
    });

    await File.deleteOne({ userID: userID, fileID: fileID });

    return res.status(200).json("file deleted");
  } catch (err) {
    console.log(err);
    return res.status(500).json("internal server error");
  }
};

exports.downloadFile = async (req, res) => {
  const fileID = req.params.fileID;

  try {
    const file = await File.findOne({ fileID: fileID });

    if (!file) {
      return res.status(404).json("File not found");
    }

    const filePath = file.link;
    const fileName = file.fileName;

    console.log(fileID);
    console.log(filePath);

    // Check if the file exists
    const fileExists = await fs.promises
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      return res.status(404).json("File not found on the server");
    }

    // Trigger file download
    res.download(filePath, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        res.status(500).json("Error downloading file");
      }
    });
  } catch (err) {
    console.error("Error downloading file:", err);
    res.status(500).json("Internal server error");
  }
};

async function handlePdf(introduction, filePath, questions, answers) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const pdfStream = fs.createWriteStream(filePath);

    doc.pipe(pdfStream);

    doc.fontSize(18).text(introduction + "\n\n", { align: "left" });

    const minLength = Math.min(questions.length, answers.length);
    for (let i = 0; i < minLength; i++) {
      const question = `Question ${i + 1}: ${questions[i]}`;

      const answer = `Answer ${i + 1}: ${answers[i]}`;
      doc
        .fontSize(16)
        .fillColor("blue")
        .text(question + "\n\n\n");

      doc
        .fontSize(16)
        .fillColor("black")
        .text(answer + "\n\n\n");
    }

    doc.end();

    pdfStream.on("finish", () => {
      resolve(true);
    });

    pdfStream.on("error", (err) => {
      reject(err);
    });
  });
}

async function handleTxt(introduction, filePath, questions, answers) {
  try {
    let content = `${introduction}\n\n`;
    questions.forEach((question, index) => {
      const answer = answers[index] || ""; // If there's no answer, leave it blank
      content += `Question ${index + 1}: ${question}\nAnswer ${
        index + 1
      }: ${answer}\n\n`;
    });

    await fs.promises.writeFile(filePath, content); // Use promises version of writeFile
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}
