const express = require("express");
const router = express.Router();

const foldersController = require("../controllers/foldersController");

router.post("/createFolder", foldersController.createFolder);

module.exports = router;
