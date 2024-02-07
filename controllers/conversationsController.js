const Conversation = require("../models/Conversation");
const User = require("../models/User");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const File = require("../models/File");

async function generateAiResponse(prompt) {
  try {
    const genAI = new GoogleGenerativeAI(
      "AIzaSyCA8YL-sVujSPntlkoHXb5spzypTvr_vHM"
    );
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // console.log(text);
    return text;
  } catch {
    return "LLama model is unavalibe now, try again later";
  }
}

async function createMemory(question, answer) {
  const preview =
    "the following is a user question and answer that an AI gave. I want you to set a title to this conversation. Your response must be a maximum of three words. Don't add any explanation, only one, two, or three words that give a proper title to this conversation.";
  const title_request =
    preview + " The question is: " + question + " The answer is: " + answer;
  const title = await generateAiResponse(title_request);
}

// controller to create a conversation
exports.postConversation = async (req, res) => {
  const title = "untitled conversation";
  console.log("rech post conversation");

  const conversationID = new mongoose.Types.ObjectId();
  if (!req.body.userID) {
    return res.status(401).json({ msg: "user not sented" });
  }
  // const currentTimestamp = new Date().toISOString().split("T")[0];
  const currentTimestamp = Date.now() / 1000;

  // need to search if user is exsting
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
  });
  newConversation.questions.push(req.body.prompt);
  const aiResponse = await generateAiResponse(req.body.prompt);
  newConversation.answers.push(aiResponse);
  // const question_title = await setConversationTitle(
  //   req.body.prompt,
  //   aiResponse
  // );
  // newConversation.title = question_title;
  newConversation.title = "maintence";
  newConversation
    .save()
    .then((result) => {
      res
        .status(201)
        .json({ conversationID: conversationID, aiResponse: aiResponse });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    });
};

// controller to hanlde new question in conversation
exports.postToConversation = async (req, res) => {
  console.log("rech post to");
  const conversationID = req.body.conversationID;
  const userID = req.body.userID;
  const prompt = req.body.prompt;

  const loadedConversation = await Conversation.findOne({ conversationID });
  if (!loadedConversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  loadedConversation.questions.push(prompt);
  const aiResponse = await generateAiResponse(prompt);
  loadedConversation.answers.push(aiResponse);
  // loadedConversation.timestamp = new Date().toISOString().split("T")[0];
  loadedConversation.timestamp = Date.now()/1000;
  await loadedConversation.save();
  return res.status(200).json({ aiResponse: aiResponse });
};

exports.getConversation = async (req, res) => {
  const conversationID = req.body.conversationID;
  const loadedConversation = await Conversation.findOne({ conversationID });
  if (!loadedConversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  const questions = loadedConversation.questions || [];
  const answers = loadedConversation.answers || [];
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
  return res.status(200).json({ messages: messages });
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

async function setConversationTitle(question, answer) {
  try {
    const preview =
      "the following is a user question and answer that an AI gave. I want you to set a title to this conversation. Your response must be a maximum of three words. Don't add any explanation, only one, two, or three words that give a proper title to this conversation.";
    const title_request =
      preview + " The question is: " + question + " The answer is: " + answer;
    const title = await generateAiResponse(title_request);
    console.log(title);
    return title;
  } catch {
    return "test conv";
  }
}

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
