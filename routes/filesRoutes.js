const express = require("express");
const router = express.Router();

const filesController = require("../controllers/filesController");

router.post("/saveConversationFile", filesController.saveConversationToFile);

router.post("/getFiles", filesController.getFiles);

router.post("/deleteFile", filesController.deleteFile);

router.get("/downloadFile/:fileID", filesController.downloadFile);

module.exports = router;
