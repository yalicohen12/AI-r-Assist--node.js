const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const upload = multer();

const conversationController = require("../controllers/conversationsController");

const { authenticateToken } = require("../middlewares/authMiddleware");

// route to create a conversation
// router.post(
//   "/createConversation",
//   upload.single("file"),
//   conversationController.postConversation
// );

router.post(
  "/createAPIConversation",
  upload.single("file"),
  conversationController.APIpostConversation
);

router.post(
  "/postToAPIConversation",
  upload.single("file"),
  conversationController.APIpostToConversation
);

// route to add question to conversation
// router.post(
//   "/postToConversation",
//   upload.single("file"),
//   conversationController.postToConversation
// );

router.post(
  "/getConversation",
  authenticateToken,
  conversationController.getConversation
);

router.post(
  "/getConversations",
  authenticateToken,
  conversationController.getConversations
);

router.post(
  "/deleteConversation",
  authenticateToken,
  conversationController.deleteConversation
);

router.post(
  "/deleteMessage",
  authenticateToken,
  conversationController.deleteMessage
);

// router.post(
//   "/regenerateResponse",
//   // authenticateToken,
//   conversationController.regenerateResponse
// );

router.post(
  "/APIRegenerateResponse",
  authenticateToken ,
  conversationController.APIregenerateResponse
);

router.post(
  "/renameConversation",
  authenticateToken,
  conversationController.renameConversation
);

module.exports = router;
