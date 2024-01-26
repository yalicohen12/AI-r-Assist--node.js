const express = require("express");
const router = express.Router();

const conversationController = require("../controllers/conversationsController");

// route to create a conversation
router.post("/createConversation", conversationController.postConversation);

// route to add question to conversation
router.post("/postToConversation", conversationController.postToConversation);

router.post("/getConversation", conversationController.getConversation);

router.post("/getConversations", conversationController.getConversations);

router.post("/deleteConversation", conversationController.deleteConversation);

router.post("/saveConversationFile", conversationController.saveConversation);

module.exports = router;
