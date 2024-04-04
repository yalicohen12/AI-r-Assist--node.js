const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const upload = multer();

const conversationController = require("../controllers/conversationsController");

// route to create a conversation
router.post(
  "/createConversation",
  upload.single("file"),
  conversationController.postConversation
);

// route to add question to conversation
router.post(
  "/postToConversation",
  upload.single("file"),
  conversationController.postToConversation
);

router.post("/getConversation", conversationController.getConversation);

router.post("/getConversations", conversationController.getConversations);

router.post("/deleteConversation", conversationController.deleteConversation);

router.post("/deleteMessage", conversationController.deleteMessage);

router.post("/regenerateResponse", conversationController.regenerateResponse);

router.post("/renameConversation", conversationController.renameConversation);

module.exports = router;
