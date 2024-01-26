const mongoose = require("mongoose");
const User = require("../models/User");
const Folder = require("../models/Folder");

exports.createFolder = async (req, res) => {
  const userID = req.body.userID;
  const folderName = req.body.folderName;
  const loadedUser = await User.findOne({ ID: userID });
  if (!loadedUser) {
    res.status(404).json("user not found");
  }
  const inputPath = req.body.path;
};
