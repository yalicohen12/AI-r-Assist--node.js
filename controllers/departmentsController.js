const mongoose = require("mongoose");
const User = require("../models/User");
const Folder = require("../models/Folder");
const Department = require("../models/Department");
const fs = require("fs").promises;
const path = require("path");

exports.createDepartment = async (req, res) => {
  try {
    const userID = req.body.userID;

    loadedUser = await User.findOne({ ID: userID });
    if (!loadedUser) {
      return res.status(404).json("user not found");
    }
    const depName = req.body.departmentName;
    if (!depName) {
      return res.status(400).json("must fill departmnet name");
    }
    const code = req.body.code;
    const depOwner = [];
    depOwner.push(loadedUser.ID);
    const newDepartment = new Department({
      departmentID: new mongoose.Types.ObjectId(),
      name: depName,
      owner: depOwner,
      folders: [],
      code: code,
    });
    await newDepartment.save();

    const libraryPath = path.join(__dirname, "../libary");
    const departmentPath = path.join(libraryPath, depName);

    await fs.mkdir(departmentPath);

    const rootHalfPath = path.join(__dirname, `../libary/${depName}`);
    const rootPath = path.join(rootHalfPath, "root");

    await fs.mkdir(rootPath);

    return res.status(201).json("created Departmnet");
  } catch (err) {
    console.log(err);
    return res.status(500).json("intenal error");
  }
};
