// controller to create a conversation
exports.postConversation = async (req, res) => {
    const title = "untitled conversation";
    console.log("rech post conversation");
    // console.log(req.file);
  
    const anotation = req.body.anotation;
  
    const conversationID = new mongoose.Types.ObjectId();
  
    const loadedUser = await User.findOne({ ID: req.body.userID });
  
    if (!req.body.userID) {
      return res.status(401).json({ msg: "user not sented" });
    }
    const currentTimestamp = Date.now() / 1000;
  
    const modelStatus = req.body.modelStatus;
  
    const fileName = req.body.fileName;
  
    let fileDetails = {};
  
    let fileDataFromName = "";
  
    if (req.file) {
      console.log("notice a new file");
      if (
        (await ensureFileIsNew(req.body.userID, req.file.originalname)) == true
      ) {
        console.log("confrimed its new");
        fileDetails = await saveFile(req.file, req.body.userID);
      } else {
        let path = getFilePath(req.body.userID, req.file.originalname);
        fileDataFromName = await extractDataFromFile(path);
      }
    }
    let fileData = "";
  
    if (fileDetails.filePath) {
      fileData = await extractDataFromFile(fileDetails.filePath);
    }
  
    if (!req.file && fileName) {
      console.log("notice fileName");
      if (!(await ensureFileIsNew(req.body.userID, fileName))) {
        let fileP = getFilePath(req.body.userID, fileName);
  
        fileDataFromName = await extractDataFromFile(fileP);
  
        const fileIDFromName = await extractFileIDFromName(
          fileName,
          req.body.userID
        );
  
        fileDetails.filePath = fileIDFromName;
      }
    }
  
    let conversationCounter = await getConversationsCounter(req.body.userID);
    conversationCounter = loadedUser.convesationCount;
    loadedUser.convesationCount += 1;
  
    // console.log(conversationCounter)
  
    const conversationTitle = `${loadedUser.name} Chat ${
      conversationCounter + 1
    } `;
    console.log(conversationTitle);
  
    // console.log(fileDetails);
  
    // console.log("fileD: ", fileData);
  
    const newConversation = new Conversation({
      user: {
        ID: req.body.userID,
      },
      conversationID: conversationID,
      questions: [],
      answers: [],
      memory: [],
      title: conversationTitle,
      timestamp: currentTimestamp,
      fileID: fileDetails.fileID,
    });
    console.log("model status is: ", modelStatus);
  
    newConversation.questions.push(req.body.prompt);
  
    newConversation.save();
  
    let aiResponse = "";
  
    if (modelStatus === "offline") {
      console.log("reach offline");
      res
        .status(200)
        .json({ conversationID: conversationID, title: conversationTitle });
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
  
      if (rawReponse.data) {
        aiResponse += rawReponse.data;
      } else {
        aiResponse = "There was an Error try again Please";
      }
      console.log("returning to user: ", aiResponse);
      res.status(200).json({
        aiResponse: aiResponse,
        conversationID: conversationID,
        title: conversationTitle,
      });
    }
    let prompt_memo = "";
    if (wordCount(req.body.prompt) > 40) {
      prompt_memo = await axios.post("http://localhost:5000/generate_memory", {
        prompt: req.body.prompt,
      });
      console.log(prompt_memo.data);
      newConversation.memorySize += wordCount(prompt_memo.data.summary);
    } else {
      prompt_memo = req.body.prompt;
      newConversation.memorySize += wordCount(req.body.prompt);
    }
  
    let ai_memo = "";
    if (wordCount(aiResponse) > 30) {
      ai_memo = await axios.post("http://localhost:5000/generate_memory", {
        prompt: aiResponse,
      });
    } else {
      ai_memo = aiResponse;
    }
  
    newConversation.memory.push(
      "User: " + (prompt_memo.data ? prompt_memo.data.summary : prompt_memo)
    );
  
    newConversation.memory.push(
      "LLM: " + (ai_memo.data ? ai_memo.data.summary : ai_memo)
    );
  
    newConversation.answers.push(aiResponse);
    // newConversation.title = "maintence";
    await newConversation.save();
  
    await loadedUser.save();
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
  
      if (!loadedConversation) {
        return res.status(404).json("conversation not found");
      }
  
      let fileID = "";
      let fileData = "";
  
      let fileDetails = {};
  
      const promptWordCount = wordCount(prompt);
  
      if (loadedConversation.memorySize + promptWordCount > 700) {
        handleMemoryOverflow(loadedConversation.memory);
      }
  
      if (req.file) {
        console.log("notice the file");
        if (await ensureFileIsNew(req.body.userID, req.file.originalname)) {
          fileDetails = await saveFile(req.file, req.body.userID);
  
          fileID = fileDetails.fileID;
  
          loadedConversation.fileID = fileID;
  
          fileData = await extractDataFromFile(fileDetails.filePath);
        }
      }
      if (!req.file && fileName) {
        console.log("notice fileName");
        if (!(await ensureFileIsNew(req.body.userID, fileName))) {
          let fileP = getFilePath(req.body.userID, fileName);
  
          fileData = await extractDataFromFile(fileP);
        }
      }
      let fileWordCount = 0;
      if (fileData.length > 2) {
        fileWordCount = wordCount(fileData);
      }
  
      if (!loadedConversation) {
        console.log("conversation not found");
        return res.status(404).json({ error: "Conversation not found" });
      }
  
      loadedConversation.questions.push(prompt);
  
      // loadedConversation.fileID = fileID.toString();
  
      let aiResponse = "";
  
      // console.log("sending file data of: ", fileData);
  
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
  
        if (rawReponse.data) {
          aiResponse += rawReponse.data;
        } else {
          aiResponse = "There was an Error try again Please";
        }
  
        res
          .status(200)
          .json({ aiResponse: aiResponse, conversationID: conversationID });
      }
      // console.log("ai is: ", aiResponse);
  
      const aiResponseParsed = removeCodeBlocks(aiResponse);
  
      let prompt_memo = "";
  
      if (promptWordCount > 40) {
        console.log("in summary generation");
        const rawReponseAPi = await axios.post(
          "http://localhost:5000/generate_memory",
          {
            prompt: req.body.prompt,
          }
        );
        prompt_memo = rawReponseAPi.data.summary[0];
        loadedConversation.memorySize += wordCount(prompt_memo);
      } else {
        prompt_memo = req.body.prompt;
        // console.log("prompt has: ", promptWordCount);
        loadedConversation.memorySize += promptWordCount;
      }
  
      let ai_memo = "";
  
      if (wordCount(aiResponseParsed) > 30) {
        const rawApi = await axios.post("http://localhost:5000/generate_memory", {
          prompt: aiResponseParsed,
        });
        ai_memo = rawApi.data.summary[0];
        // console.log("obj: ");
        // console.log(ai_memo);
        loadedConversation.memorySize += wordCount(ai_memo);
      } else {
        ai_memo = aiResponseParsed;
        loadedConversation.memorySize += wordCount(ai_memo);
      }
      // console.log("prompt memo is: ", prompt_memo);
      // console.log("ai memo is ", ai_memo);
  
      loadedConversation.memory.push("User: " + prompt_memo);
  
      loadedConversation.memory.push("LLM: " + ai_memo);
  
      loadedConversation.answers.push(aiResponse);
  
      loadedConversation.timestamp = Date.now() / 1000;
      await loadedConversation.save();
    } catch (err) {
      console.log(err);
    }
  };


  exports.regenerateResponse = async (req, res) => {
    console.log("reach regenerate");
    try {
      console.log(req.body);
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
      console.log(answerIndex);
  
      console.log("raw index is: ", rawIndex);
  
      console.log("question index is: ", questionIndex);
  
      console.log("answer index is: ", answerIndex);
  
      console.log("ai memi before: ", loadedConversation.memory[answerIndex]);
  
      loadedConversation.memorySize -= wordCount(
        loadedConversation.memory[answerIndex]
      );
  
      const prompt =
        loadedConversation.questions[questionIndex] +
        " the user was not pleased with your answer, try to answer better";
  
      console.log(prompt);
  
      let aiResponse = "";
      console.log(modelStatus);
  
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
  
        if (rawReponse.data) {
          aiResponse += rawReponse.data;
        } else {
          aiResponse = "There was an Error try again Please";
        }
  
        console.log(aiResponse);
  
        res.status(200).json({ aiResponse: aiResponse });
      }
      const aiResponseParsed = removeCodeBlocks(aiResponse);
  
      const ai_memo = await axios.post("http://localhost:5000/generate_memory", {
        prompt: aiResponseParsed,
      });
  
      loadedConversation.memory[rawIndex] = "LLM: " + ai_memo.data.summary[0];
  
      console.log("ai mem after: ", ai_memo.data.summary[0]);
  
      loadedConversation.memorySize += wordCount(ai_memo.data.summary[0]);
  
      loadedConversation.answers[answerIndex] = aiResponse;
  
      loadedConversation.timestamp = Date.now() / 1000;
      await loadedConversation.save();
    } catch (err) {
      console.log(err);
      return res.status(401).json(err);
    }
  };
  
  