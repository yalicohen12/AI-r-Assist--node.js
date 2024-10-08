const Conversation = require("../models/Conversation");
const User = require("../models/User");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const File = require("../models/File");
const axios = require("axios");
const send_prompt = require("./socket_server_send");

const util = require("util");

//create conversation hanlder
exports.APIpostConversation = async (req, res) => {
  console.log("Received API POST conversation request");

  const { userID, prompt, modelStatus, fileName, anotation } = req.body;

  if (!userID) {
    return res.status(401).json({ msg: "User ID not provided" });
  }

  const conversationID = new mongoose.Types.ObjectId();
  const loadedUser = await User.findOne({ ID: userID });
  const currentTimestamp = Date.now() / 1000;

  let fileDetails = {};
  let fileData = "";
  let fileDataFromName = "";

  // Handle file upload
  if (req.file) {
    console.log("New file detected");
    if (await ensureFileIsNew(userID, req.file.originalname)) {
      console.log("Confirmed new file");
      fileDetails = await saveFile(req.file, userID);
      fileData = await extractDataFromFile(fileDetails.filePath);
    } else {
      const filePath = getFilePath(userID, req.file.originalname);
      fileDataFromName = await extractDataFromFile(filePath);
    }
  }

  // Handle file lookup if filename is provided but no file is uploaded
  if (!req.file && fileName) {
    console.log("File name provided");
    if (!(await ensureFileIsNew(userID, fileName))) {
      const filePath = getFilePath(userID, fileName);
      fileDataFromName = await extractDataFromFile(filePath);

      const fileIDFromName = await extractFileIDFromName(fileName, userID);
      fileDetails.filePath = fileIDFromName;
    }
  }

  // Handle conversation counter and title
  const conversationCounter = loadedUser.convesationCount;
  loadedUser.convesationCount += 1;

  const conversationTitle = `${loadedUser.name} Chat ${
    conversationCounter + 1
  }`;
  console.log("Conversation Title:", conversationTitle);

  // Create a new conversation
  const newConversation = new Conversation({
    user: { ID: userID },
    conversationID,
    questions: [prompt],
    answers: [],
    memory: [],
    title: conversationTitle,
    timestamp: currentTimestamp,
    fileID: fileDetails.fileID,
  });

  console.log("Model status is:", modelStatus);

  // Handle AI response
  let aiResponse = "";
  const requestData = {
    prompt,
    memory: [],
    anotation,
    fileData: fileData || fileDataFromName,
  };

  if (modelStatus === "offline") {
    console.log("Using offline model");
    const response = await axios.post(
      "http://localhost:5000/offlineAPIResponse",
      requestData
    );
    aiResponse = response.data;
  } else {
    console.log("Using online model");
    const response = await axios.post(
      "http://localhost:5000/APIResponse",
      requestData
    );
    aiResponse = response.data || "There was an error, please try again.";
  }

  res.status(200).json({
    aiResponse,
    conversationID,
    title: conversationTitle,
  });

  // Handle memory summary for prompt and AI response
  let promptMemo = "";
  if (wordCount(prompt) > 40) {
    const summaryResponse = await axios.post(
      "http://localhost:5000/generate_memory",
      { prompt }
    );
    promptMemo = summaryResponse.data.summary[0];
    newConversation.memorySize += wordCount(promptMemo);
  } else {
    promptMemo = prompt;
    newConversation.memorySize += wordCount(prompt);
  }

  let aiMemo = "";
  if (wordCount(aiResponse) > 30) {
    const summaryResponse = await axios.post(
      "http://localhost:5000/generate_memory",
      { prompt: aiResponse }
    );
    aiMemo = summaryResponse.data.summary;
    // console.log("memory input: ", aiResponse);
    // console.log("memory output: ", aiMemo);
    newConversation.memorySize += wordCount(aiMemo);
  } else {
    aiMemo = aiResponse;
    newConversation.memorySize += wordCount(aiMemo);
  }

  // Update conversation memory and answers
  newConversation.memory.push(`User: ${promptMemo}`);
  newConversation.memory.push(`LLM: ${aiMemo}`);
  newConversation.answers.push(aiResponse);

  await newConversation.save();
  await loadedUser.save();
};

// update conversation handler
exports.APIpostToConversation = async (req, res) => {
  console.log("rech API post to");
  try {
    const { conversationID, userID, prompt, modelStatus, fileName, anotation } =
      req.body;

    const loadedConversation = await Conversation.findOne({ conversationID });
    if (!loadedConversation) {
      return res.status(404).json("Conversation not found");
    }

    let fileID = "";
    let fileData = "";

    const promptWordCount = wordCount(prompt);

    if (loadedConversation.memorySize + promptWordCount > 700) {
      handleMemoryOverflow(loadedConversation.memory);
    }

    // Handle file upload if present
    if (req.file) {
      console.log("File detected in request");
      if (await ensureFileIsNew(userID, req.file.originalname)) {
        const fileDetails = await saveFile(req.file, userID);
        fileID = fileDetails.fileID;
        loadedConversation.fileID = fileID;
        fileData = await extractDataFromFile(fileDetails.filePath);
      }
    }

    // Handle file lookup if filename is provided but no file is uploaded
    if (!req.file && fileName) {
      console.log("File name provided");
      if (!(await ensureFileIsNew(userID, fileName))) {
        const filePath = getFilePath(userID, fileName);
        fileData = await extractDataFromFile(filePath);
      }
    }

    const fileWordCount = fileData ? wordCount(fileData) : 0;

    loadedConversation.questions.push(prompt);

    let aiResponse = "";
    const requestData = {
      prompt,
      memory: loadedConversation.memory,
      fileData,
      anotation,
    };

    // Handle online or offline model status
    if (modelStatus === "offline") {
      console.log("Using offline model");
      const response = await axios.post(
        "http://localhost:5000/offlineAPIResponse",
        requestData
      );
      aiResponse = response.data;
    } else {
      console.log("Using online model");
      const response = await axios.post(
        "http://localhost:5000/APIResponse",
        requestData
      );
      aiResponse = response.data || "There was an Error. Please try again.";
    }

    res.status(200).json({ aiResponse, conversationID });

    const aiResponseParsed = removeCodeBlocks(aiResponse);

    let promptMemo =
      promptWordCount > 40
        ? (
            await axios.post("http://localhost:5000/generate_memory", {
              prompt,
            })
          ).data.summary[0]
        : prompt;

    loadedConversation.memorySize += wordCount(promptMemo);

    let aiMemo =
      wordCount(aiResponseParsed) > 30
        ? (
            await axios.post("http://localhost:5000/generate_memory", {
              prompt: aiResponseParsed,
            })
          ).data.summary
        : aiResponseParsed;

    // console.log("memory input: ", aiResponseParsed);
    // console.log("memory output: ", aiMemo);

    loadedConversation.memorySize += wordCount(aiMemo);

    loadedConversation.memory.push(`User: ${promptMemo}`);
    loadedConversation.memory.push(`LLM: ${aiMemo}`);
    loadedConversation.answers.push(aiResponse);
    loadedConversation.timestamp = Date.now() / 1000;

    await loadedConversation.save();
  } catch (err) {
    console.log(err);
  }
};

exports.APIregenerateResponse = async (req, res) => {
  console.log("Received regenerate response request");

  try {
    const { conversationID, userID, modelStatus, index: rawIndex } = req.body;

    console.log(req.body);

    const loadedConversation = await Conversation.findOne({
      conversationID,
      "user.ID": userID,
    });

    if (!loadedConversation) {
      return res.status(404).json("Conversation not found");
    }

    if (rawIndex == null) {
      return res.status(400).json("Index not provided");
    }

    const answerIndex = Math.floor(rawIndex / 2);
    const questionIndex = answerIndex;

    console.log("Answer index:", answerIndex);
    console.log("Question index:", questionIndex);

    // Adjust memory size by removing the previous answer's word count
    loadedConversation.memorySize -= wordCount(
      loadedConversation.memory[rawIndex]
    );

    const prompt = `${loadedConversation.questions[questionIndex]} the user was not pleased with your answer, try to answer better`;

    console.log("Prompt:", prompt);

    // Initialize AI response
    let aiResponse = "";

    const requestData = {
      prompt,
      memory: loadedConversation.memory.slice(0, rawIndex),
      fileData: "",
      anotation: "",
    };

    // Generate AI response based on model status
    if (modelStatus === "offline") {
      console.log("Using offline model");
      const response = await axios.post(
        "http://localhost:5000/offlineAPIResponse",
        requestData
      );
      aiResponse = response.data;
    } else {
      console.log("Using online model");
      const response = await axios.post(
        "http://localhost:5000/APIResponse",
        requestData
      );
      aiResponse = response.data || "There was an Error, please try again.";
    }

    console.log("AI Response:", aiResponse);

    // Send AI response to client
    res.status(200).json({ aiResponse });

    // Process AI response for memory update
    const aiResponseParsed = removeCodeBlocks(aiResponse);
    const summaryResponse = await axios.post(
      "http://localhost:5000/generate_memory",
      {
        prompt: aiResponseParsed,
      }
    );

    const aiSummary = summaryResponse.data.summary;

    console.log("AI Memory after regeneration:", aiSummary);

    // Update conversation memory and answers
    loadedConversation.memory[rawIndex] = `LLM: ${aiSummary}`;
    loadedConversation.memorySize += wordCount(aiSummary);
    loadedConversation.answers[answerIndex] = aiResponse;
    loadedConversation.timestamp = Date.now() / 1000;

    await loadedConversation.save();
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getConversation = async (req, res) => {
  const conversationID = req.body.conversationID;
  const loadedConversation = await Conversation.findOne({ conversationID });
  if (!loadedConversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  const loadedUser = await User.findOne({ ID: loadedConversation.user.ID  || "You"});
  const questions = loadedConversation.questions || [];
  const answers = loadedConversation.answers || [];

  const fileIndicator = loadedConversation.fileID;
  let fileName = "";
  if (fileIndicator != "") {
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
    messages.push({ sender: loadedUser.name, value: question });
    messages.push({ sender: "LLama", value: answer });
  }
  return res.status(200).json({ messages: messages, fileName });
};

//controller to get conversations
exports.getConversations = async (req, res) => {
  // console.log("get conversations")
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
  return text.replace(/```[\s\S]*?```/g, "");
}

async function saveFile(fileObj, userID) {
  try {
    console.log("saving file");
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

const readFileAsync = util.promisify(fs.readFile);

async function extractDataFromFile(filePath) {
  try {
    const data = await readFileAsync(filePath, "utf8");
    console.log("Text file content extracted from: ", filePath);
    // console.log("File data:", data);
    return data;
  } catch (err) {
    console.error("Error reading file:", err);
    return null;
  }
}

// (async () => {
//   const filePath =
//     "C:\\Users\\yalik\\AI-r Assist\\node.js-server\\libary\\659674eeb90c2146ea6f85fd\\sharon.pdf"; // Change this to your file path
//   const content = await extractDataFromFile(filePath);
//   console.log(content);
// })();

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

function wordCount(str) {
  const array = str.trim().split(/\s+/);
  return array.length;
}

function handleMemoryOverflow(memory, maxLength) {
  console.log("memory is oveflowed");
  let totalLength = 0;
  let currentIndex = 0;

  for (let i = 0; i < memory.length; i++) {
    totalLength += wordCount(memory[i]);
  }

  // Loop until the total length is within the maxLength or we reach the end of memory
  while (totalLength > maxLength && currentIndex < memory.length) {
    const currentMessage = memory[currentIndex];
    const isQuestion = currentIndex % 2 === 0; // Check if it's a question

    let maxWords = isQuestion ? 20 : 15; // Maximum words for question and answer
    let truncatedMessage = currentMessage
      .split(/\s+/)
      .slice(0, maxWords)
      .join(" ");

    // Update the memory with the truncated message
    memory[currentIndex] = truncatedMessage;

    // Update total length after truncation
    totalLength = 0;
    for (let i = 0; i < memory.length; i++) {
      totalLength += wordCount(memory[i]);
    }

    // Move to the next message
    currentIndex++;
  }
}

async function extractFileIDFromName(fileName, userID) {
  const loadedFile = await File.findOne({ userID: userID, fileName: fileName });

  if (!loadedFile) {
    return 0;
  }
  return loadedFile.fileID;
}

async function getConversationsCounter(userID) {
  const loadedConversations = await Conversation.find({ "user.ID": userID });

  // console.log(loadedConversations.length);

  let name = `chat ${loadedConversations.length}`;

  let isLegal = true;

  for (const conversation of loadedConversations) {
    if (conversation.title.includes(name)) {
      isLegal = false;
      return;
    }
  }
  return loadedConversations.length;
}
