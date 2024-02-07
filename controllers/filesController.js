const mongoose = require("mongoose");
const User = require("../models/User");
const Folder = require("../models/Folder");
const Department = require("../models/Department");
const fs = require("fs");
const path = require("path");
const Conversation = require("../models/Conversation");
const PDFDocument = require("pdfkit");
const File = require("../models/File");

exports.saveConversationToFile = async (req, res) => {
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

    const loadedDep = await Department.findOne({
      departmentID: req.body.departmentID,
    });

    const loadedFolder = await Folder.findOne({ folderID: req.body.folderID });

    const fileName = `${req.body.title}.pdf`;
    const directoryPath = path.join(
      __dirname,
      `../libary/${loadedDep.name}/${loadedFolder.name}`
    );
    const filePath = path.join(directoryPath, fileName);

    const doc = new PDFDocument();
    const pdfStream = fs.createWriteStream(filePath);

    doc.pipe(pdfStream);

    doc.fontSize(14).text(introduction + "\n\n", { align: "left" });

    const minLength = Math.min(questions.length, answers.length);
    for (let i = 0; i < minLength; i++) {
      const question = `Question ${i + 1}: ${questions[i]}`;
      const answer = `Answer ${i + 1}: ${answers[i]}`;
      doc.fontSize(12).text(question + "\n\n\n");
      doc.fontSize(12).text(answer + "\n\n");
    }

    doc.end();
    const fileID = new mongoose.Types.ObjectId();

    pdfStream.on("finish", async () => {
      const newFile = new File({
        fileID: fileID,
        fileName: fileName,
        link: filePath,
      });
      await newFile.save();

      loadedFolder.files.push(fileID);
      loadedFolder.save();
      return res
        .status(200)
        .json({ message: "PDF created successfully", filePath });
    });

    pdfStream.on("error", (err) => {
      console.error("PDF stream error:", err);
      return res.status(500).json("Failed to save PDF");
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json("Fail");
  }
};
