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

  const modelStatus = req.body.modelStatus;

  const fileName = req.body.fileName;

  let fileDetails = {};

  if (req.file) {
    if (ensureFileIsNew(req.body.userID, req.file.originalname)) {
      fileDetails = await saveFile(req.file, req.body.userID);
    }
  }

  let fileDataFromName = "";

  if (!req.file && fileName) {
    console.log("notice fileName");
    if (!(await ensureFileIsNew(req.body.userID, fileName))) {
      let fileP = getFilePath(req.body.userID, fileName);

      fileDataFromName = await extractDataFromFile(fileP);
    }
  }

  let fileData = "";

  console.log(fileDetails);

  if (fileDetails.filePath) {
    fileData = await extractDataFromFile(fileDetails.filePath);
  }

  // console.log("fileD: ", fileData);

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
    fileID: fileDetails.fileID,
  });

  newConversation.questions.push(req.body.prompt);

  let aiResponse = "";

  if (modelStatus === "offline") {
    console.log("reach offline");
    res.status(200).json({ conversationID: conversationID });
    aiResponse = await send_prompt(
      req.body.prompt,
      [],
      anotation,
      fileData || fileDataFromName
    );
  } else {
    console.log("reach online");
    const rawReponse = await axios.post("http://localhost:5000/APIResponse", {
      prompt: req.body.prompt,
      memory: [],
      fileData: fileData || fileDataFromName,
      anotation: anotation,
    });
    aiResponse =
      rawReponse.data.response ||
      rawReponse.data.answer ||
      rawReponse.data.error ||
      rawReponse.data.summary ||
      rawReponse.data ||
      "There was an Error try again Please";
    if (rawReponse.data.code) {
      aiResponse += "```" + rawReponse.data.code + "```";
    }
    console.log("returning to user: ", aiResponse);
    res
      .status(200)
      .json({ aiResponse: aiResponse, conversationID: conversationID });
  }
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

    const modelStatus = req.body.modelStatus;

    const fileName = req.body.fileName;

    const anotation = req.body.anotation;

    const loadedConversation = await Conversation.findOne({ conversationID });

    let fileID = "";
    let fileData = "";

    if (req.file) {
      console.log("notice the file");
      if (await ensureFileIsNew(req.body.userID, req.file.originalname)) {
        fileID = await saveFile(req.file, req.body.userID);

        fileData = await extractDataFromFile(fileID.filePath);
      }
    }
    if (!req.file && fileName) {
      console.log("notice fileName");
      if (!(await ensureFileIsNew(req.body.userID, fileName))) {
        let fileP = getFilePath(req.body.userID, fileName);

        fileData = await extractDataFromFile(fileP);
      }
    }

    if (!loadedConversation) {
      console.log("conversation not found");
      return res.status(404).json({ error: "Conversation not found" });
    }

    loadedConversation.questions.push(prompt);

    // loadedConversation.fileID = fileID.toString();

    let aiResponse = "";

    if (modelStatus === "offline") {
      console.log("reach offline");
      res
        .status(200)
        .json({ conversationID: loadedConversation.conversationID });
      aiResponse = await send_prompt(
        prompt,
        loadedConversation.memory,
        anotation,
        fileData
      );
    } else {
      console.log("reach online");
      const rawReponse = await axios.post("http://localhost:5000/APIResponse", {
        prompt: req.body.prompt,
        memory: loadedConversation.memory,
        fileData: fileData,
        anotation: anotation,
      });
      aiResponse =
        rawReponse.data.response ||
        rawReponse.data.answer ||
        rawReponse.data.error ||
        "There was an Error try again Please";

      console.log(aiResponse);
      if (rawReponse.data.code) {
        aiResponse += rawReponse.data.code;
      }
      res
        .status(200)
        .json({ aiResponse: aiResponse, conversationID: conversationID });
    }
    // console.log("ai is: ", aiResponse);

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
    console.log(err.data);
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

//conroller to delete a message
exports.deleteMessage = async (req, res) => {
  try {
    const conversationID = req.body.conversationID;
    const userID = req.body.userID;

    const loadedConversation = await Conversation.findOne({
      conversationID: req.body.conversationID,
      "user.ID": req.body.userID,
    });

    if (!loadedConversation) {
      return res.status(401).json("conversation not found");
    }

    const answerIndex = Math.floor(req.body.index / 2);
    // let questionIndex = answerIndex - 1;
    // if (answerIndex === 0) {
    //   questionIndex = 0;
    // }

    loadedConversation.answers.splice(answerIndex, 1);

    // loadedConversation.questions.splice(questionIndex - 1, 1);
    await loadedConversation.save();

    return res.status(200).json("messages removed");
  } catch (err) {
    console.log(err);
    return res.status(401).json("unable to remove");
  }
};

//controller to save chat to file in server

exports.regenerateResponse = async (req, res) => {
  try {
    const conversationID = req.body.conversationID;
    const userID = req.body.userID;
    const modelStatus = req.body.modelStatus;
    const loadedConversation = await Conversation.findOne({
      conversationID: req.body.conversationID,
      "user.ID": req.body.userID,
    });

    if (!loadedConversation) {
      return res.status(401).json("conversation not found");
    }
    const rawIndex = req.body.index;

    if (!rawIndex) {
      return res.status(400).json("index not found");
    }

    const answerIndex = Math.floor(req.body.index / 2);

    let questionIndex = answerIndex;
    if (answerIndex === 0) {
      questionIndex = 0;
    }

    const prompt =
      loadedConversation.questions[questionIndex] +
      " the user was not pleased with your answer, try to answer better";

    console.log(prompt);

    let aiResponse = "";

    if (modelStatus == "offline") {
      res.status(200).json("");

      aiResponse = await send_prompt(
        prompt,
        loadedConversation.memory.slice(0, rawIndex),
        "",
        ""
      );
    } else {
      const rawReponse = await axios.post("http://localhost:5000/APIResponse", {
        prompt: prompt,
        memory: loadedConversation.memory.slice(0, rawIndex),
        fileData: "",
        anotation: "",
      });
      aiResponse =
        rawReponse.data.response ||
        rawReponse.data.answer ||
        rawReponse.data.error ||
        "There was an Error try again Please";
      if (rawReponse.data.code) {
        aiResponse += rawReponse.data.code;
      }
      res.status(200).json({ aiResponse: aiResponse });
    }
    const aiResponseParsed = removeCodeBlocks(aiResponse);

    const ai_memo = await axios.post("http://localhost:5000/generate_memory", {
      prompt: aiResponseParsed,
    });

    loadedConversation.memory[rawIndex] = "Answer: " + ai_memo.data.summary;

    loadedConversation.answers[answerIndex] = aiResponseParsed;

    loadedConversation.timestamp = Date.now() / 1000;
    await loadedConversation.save();
  } catch (err) {
    console.log(err);
    return res.status(401).json(err);
  }
};

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

exports.renameConversation = async (req, res) => {
  const conversationID = req.body.conversationID;
  const userID = req.body.userID;
  console.log("renaming conversation: ", conversationID);

  const loadedConversation = await Conversation.findOne({
    conversationID: conversationID,
    "user.ID": userID,
  });
  const newName = req.body.newName;
  console.log("new conversation name is: ", newName);

  if (!newName) {
    return res.status(401).json("name not setnted");
  }
  loadedConversation.title = newName;
  loadedConversation.save();

  return res.status(200).json("title updated");
};

function removeCodeBlocks(text) {
  const parts = text.split("```");

  const filteredParts = parts.filter((part, index) => index % 2 === 0);

  const cleanedResponse = filteredParts.join("");

  return cleanedResponse;
}

async function saveFile(fileObj, userID) {
  try {
    const fileName = fileObj.originalname;

    const dirPath = path.join(__dirname, `../libary/${userID}`);
    await ensureDirectoryExistence(dirPath); // Function defined below

    const filePath = path.join(dirPath, fileName);

    const fileID = new mongoose.Types.ObjectId();

    await fs.promises.writeFile(filePath, fileObj.buffer);

    const newFile = new File({
      userID: userID,
      fileID: fileID,
      fileName: fileName,
      link: filePath,
    });
    await newFile.save();
    console.log("file saved in DB");
    return { fileID, filePath };
  } catch (err) {
    console.log(err);
    return "";
  }
}
async function ensureFileIsNew(userID, fileName) {
  const dirPath = path.join(__dirname, `../libary/${userID}`);
  const filePath = path.join(dirPath, fileName);
  // console.log(filePath);

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
    // console.log("Directory created:", dirPath);
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

function getFilePath(userID, fileName) {
  return `C:\\Users\\yalik\\AI-r Assist\\node.js-server\\libary\\${userID}\\${fileName}`;
}

const util = require("util");
const readFileAsync = util.promisify(fs.readFile);

async function extractDataFromFile(filePath) {
  try {
    const data = await readFileAsync(filePath, "utf8");
    console.log("working with the path: ", filePath);
    // console.log("File data:", data);
    return data;
  } catch (err) {
    console.error("Error reading file:", err);
    return null;
  }
}

function validateFile(fileData) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target.result;
      const textLength = text.length;

      // Perform your validation based on the text length
      // For example, you can check if the text length is within a certain range

      if (textLength > 0) {
        resolve(); // Resolve if the text length is valid
      } else {
        reject("File is empty or invalid."); // Reject with an error message if text length is not valid
      }
    };

    reader.onerror = () => {
      reject("Error reading file."); // Reject with an error message if there's an error reading the file
    };

    reader.readAsText(fileData); // Read the file data as text
  });
}

// (async () => {
//   const d = await extractDataFromFile(
//     "C:\\Users\\yalik\\AI-r Assist\\node.js-server\\libary\\659674eeb90c2146ea6f85fd\\B.java"
//   );
//   console.log(d);
// })();

// async function caf() {
//   memory = ["when was the first ever moon land?"];

//   prompte = "write python function to iterate a stack";

//   const res = await axios.post("http://localhost:5000/APIResponse", {
//     prompt: prompte,
//     memory: memory,
//     fileData: "",
//     anotation: "",
//   });

//   console.log(res.data.response);
// }
// caf()
