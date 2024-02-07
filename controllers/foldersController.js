const mongoose = require("mongoose");
const User = require("../models/User");
const Folder = require("../models/Folder");
const Department = require("../models/Department");
const path = require("path");
const fs = require("fs").promises;

exports.createFolder = async (req, res) => {
  try {
    const userID = req.body.userID;
    const loadedUser = await User.findOne({ ID: userID });
    if (!loadedUser) {
      res.status(404).json("user not found");
    }
    const depID = req.body.departmentID;
    const folderName = req.body.folderName;

    const loadedDep = await Department.findOne({ departmentID: depID });

    const departmentPath = path.join(__dirname, `../libary/${loadedDep.name}`);
    const newFolderPath = path.join(departmentPath, folderName);
    await fs.mkdir(newFolderPath);

    const folderID = new mongoose.Types.ObjectId();

    const newFolder = new Folder({
      folderID: folderID,
      name: folderName,
      link: newFolderPath,
      files: [],
    });
    await newFolder.save();
    
    loadedDep.folders.push(folderID);
    await loadedDep.save();

    return res.status(200).json("worked");
  } catch (err) {
    console.log(err);
    return res.status(500).json("L");
  }
};
