const Conversation = require("../models/Conversation");
const User = require("../models/User");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const File = require("../models/File");
const axios = require("axios");
const send_prompt = require("./socket_server_send");

// controller to create a conversation
exports.postConversation = async (req, res) => {
  const title = "untitled conversation";
  console.log("rech post conversation");
  // console.log(req.file);

  const anotation = req.body.anotation;

  const conversationID = new mongoose.Types.ObjectId();
  if (!req.body.userID) {
    return res.status(401).json({ msg: "user not sented" });
  }
  const currentTimestamp = Date.now() / 1000;

  let fileID = "";

  if (req.file) {
    if (ensureFileIsNew(req.body.userID, req.file.originalname)) {
      fileID = await saveFile(req.file, req.body.userID);
    }
  }

  const newConversation = new Conversation({
    user: {
      ID: req.body.userID,
    },
    conversationID: conversationID,
    questions: [],
    answers: [],
    memory: [],
    title: title,
    timestamp: currentTimestamp,
    fileID: fileID,
  });

  newConversation.questions.push(req.body.prompt);

  res.status(200).json({ conversationID: conversationID });

  const aiResponse = await send_prompt(req.body.prompt, [], anotation);

  const prompt_memo = await axios.post(
    "http://localhost:5000/generate_memory",
    {
      prompt: req.body.prompt,
    }
  );

  const ai_memo = await axios.post("http://localhost:5000/generate_memory", {
    prompt: aiResponse,
  });
  newConversation.memory.push("question: " + prompt_memo.data.summary);

  newConversation.memory.push("Answer: " + ai_memo.data.summary);

  newConversation.answers.push(aiResponse);
  newConversation.title = "maintence";
  await newConversation.save();
};

// controller to hanlde new question in conversation
exports.postToConversation = async (req, res) => {
  console.log("rech post to");
  try {
    const conversationID = req.body.conversationID;
    const userID = req.body.userID;
    const prompt = req.body.prompt;

    const anotation = req.body.anotation;

    const loadedConversation = await Conversation.findOne({ conversationID });

    let fileID = "";

    if (req.file) {
      console.log("notice the file");
      if (ensureFileIsNew(req.body.userID, req.file.originalname)) {
        fileID = await saveFile(req.file, req.body.userID);
      }
    }

    console.log("file iD is: ", fileID);

    if (!loadedConversation) {
      console.log("conversation not found");
      return res.status(404).json({ error: "Conversation not found" });
    }

    loadedConversation.questions.push(prompt);

    // loadedConversation.fileID = fileID.toString();

    res.status(200).json({ conversationID: loadedConversation.conversationID });

    console.log("mile1");

    const aiResponse = await send_prompt(
      prompt,
      loadedConversation.memory,
      anotation
    );
    console.log("mile2");

    const aiResponseParsed = removeCodeBlocks(aiResponse);

    const prompt_memo = await axios.post(
      "http://localhost:5000/generate_memory",
      {
        prompt: req.body.prompt,
      }
    );

    const ai_memo = await axios.post("http://localhost:5000/generate_memory", {
      prompt: aiResponseParsed,
    });
    loadedConversation.memory.push("question: " + prompt_memo.data.summary);

    loadedConversation.memory.push("Answer: " + ai_memo.data.summary);

    loadedConversation.answers.push(aiResponse);

    loadedConversation.timestamp = Date.now() / 1000;
    await loadedConversation.save();
  } catch (err) {
    console.log(err);
  }
};

exports.getConversation = async (req, res) => {
  const conversationID = req.body.conversationID;
  const loadedConversation = await Conversation.findOne({ conversationID });
  if (!loadedConversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  const questions = loadedConversation.questions || [];
  const answers = loadedConversation.answers || [];

  const fileIndicator = loadedConversation.fileID;
  let fileName = "";
  if (fileIndicator) {
    fileName = await getFileName(fileIndicator);
  }
  // fileName = "casef.js";
  // console.log(questions)
  // console.log(answers)

  const messages = [];

  const minLength = Math.min(questions.length, answers.length);

  for (let i = 0; i < minLength; i++) {
    const question = questions[i];
    const answer = answers[i];
    messages.push({ sender: "You", value: question });
    messages.push({ sender: "LLama", value: answer });
  }
  return res.status(200).json({ messages: messages, fileName });
};

//controller to get conversations
exports.getConversations = async (req, res) => {
  const userID = req.body.userID;
  if (!userID) {
    return res.status(400).json({ msg: "bad request" });
  }
  try {
    const rawConversations = await Conversation.find({
      "user.ID": userID,
    }).sort({ timestamp: -1 });
    const formattedConversations = rawConversations.map((conversation) => {
      return {
        conversationID: conversation.conversationID,
        title: conversation.title,
        timestamp: conversation.timestamp,
      };
    });
    return res.status(200).json({ conversations: formattedConversations });
  } catch {
    (err) => {
      return res.status(500).json(err);
    };
  }
};

//delete conversation
exports.deleteConversation = async (req, res) => {
  try {
    const conversationID = req.body.conversationID;
    const userID = req.body.userID;

    const existingConversation = await Conversation.findOne({
      conversationID: conversationID,
      "user.ID": userID,
    });

    if (!existingConversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    await Conversation.deleteOne({
      conversationID: conversationID,
      "user.ID": userID,
    });
    return res
      .status(200)
      .json({ message: "Conversation deleted successfully" });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
};

//controller to save chat to file in server

exports.saveConversation = async (req, res) => {
  try {
    const loadedConversation = await Conversation.findOne({
      conversationID: req.body.conversationID,
      "user.ID": req.body.userID,
    });

    if (!loadedConversation) {
      return res.status(401).json("conversation not found");
    }

    const questions = loadedConversation.questions || [];
    const answers = loadedConversation.answers || [];
    const introduction = req.body.introduction;

    const fileName = `${req.body.title}_${req.body.userID}_${req.body.conversationID}_conversation.pdf`;
    const directoryPath = path.join(__dirname, "files");
    const filePath = path.join(__dirname, "..", "files", fileName);

    // Create the directory if it doesn't exist
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }

    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(14).text(introduction + "\n\n", { align: "left" });

    const minLength = Math.min(questions.length, answers.length);
    for (let i = 0; i < minLength; i++) {
      const question = `Question ${i + 1}: ${questions[i]}`;
      const answer = `Answer ${i + 1}: ${answers[i]}`;
      doc.fontSize(12).text(question + "\n\n\n");
      doc.fontSize(12).text(answer + "\n\n");
    }

    doc.end();
    const newFile = File({
      fileID: new mongoose.Types.ObjectId(),
      fileName: fileName,
      link: filePath,
    });
    await newFile.save();

    return res
      .status(200)
      .json({ message: "PDF created successfully", filePath });
  } catch (err) {
    return res.status(500).json(err.message);
  }
};

function removeCodeBlocks(text) {
  const parts = text.split("```");

  const filteredParts = parts.filter((part, index) => index % 2 === 0);

  const cleanedResponse = filteredParts.join("");

  return cleanedResponse;
}

async function saveFile(fileObj, userID) {
  console.log("at leasr try..");
  try {
    const fileName = fileObj.originalname;

    const dirPath = path.join(__dirname, `../libary/${userID}`);
    await ensureDirectoryExistence(dirPath); // Function defined below

    const filePath = path.join(dirPath, fileName);

    const fileID = new mongoose.Types.ObjectId();

    await fs.promises.writeFile(filePath, fileObj.buffer);

    const newFile = new File({
      fileID: fileID,
      fileName: fileName,
      link: filePath,
    });
    await newFile.save();
    console.log("file saved in DB");
    return fileID;
  } catch (err) {
    console.log(err);
    return "";
  }
}
async function ensureFileIsNew(userID, fileName) {
  const dirPath = path.join(__dirname, `../libary/${userID}`);
  const filePath = path.join(dirPath, fileName);
  console.log(filePath);

  try {
    if (fs.existsSync(filePath)) {
      console.log(`File '${fileName}' already exists.`);
      return false; // File already exists
    } else {
      console.log(`File '${fileName}' doesn't exist.`);
      return true; // File doesn't exist
    }
  } catch (err) {}
}

async function ensureDirectoryExistence(dirPath) {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true }); // Create directories if they don't exist
    console.log("Directory created:", dirPath);
  } catch (err) {
    console.error("Error creating directory:", err);
    throw err; // Re-throw the error to propagate to the main function
  }
}

async function getFileName(fileID) {
  // console.log(fileID);
  const loadedFile = await File.find({ fileID: fileID });
  // console.log(loadedFile[0].fileName);

  if (loadedFile.length === 0) {
    return "";
  }

  return loadedFile[0].fileName;
}
