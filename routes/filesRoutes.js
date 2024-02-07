const express = require("express");
const router = express.Router();

const filesController = require("../controllers/filesController");


router.post("/saveConversationFile", filesController.saveConversationToFile);


module.exports = router;

