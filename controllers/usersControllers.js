const User = require("../models/User");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

exports.signup = async (req, res) => {
  try {
    console.log("reach signup");
    const name = req.body.name;
    const isUsernameUnique = await User.findOne({ name });

    if (isUsernameUnique) {
      return res.status(409).json("user name already exsits");
    }
    const password = req.body.password;

    const hashPassword = await bcrypt.hash(password, 10);

    const userID = new mongoose.Types.ObjectId();

    const user = new User({
      ID: userID,
      name: name,
      password: hashPassword,
    });

    user.save();
    console.log("Created user");
    return res.status(200).json({
      userID: userID,
      name: name,
      token: generateAccessToken(userID),
    });
  } catch {
    (err) => {
      console.log(err);
      return res.status(500).json(err);
    };
  }
};

exports.login = async (req, res) => {
  try {
    const name = req.body.name;
    const password = req.body.password;

    if (!name || !password) {
      return res.status(400).json({ msg: "user params empty" });
    }

    const loadedUser = await User.findOne({ name: name });
    // console.log(loadedUser);

    if (!loadedUser) {
      return res.status(404).json({ msg: "name not exsits" });
    }
    const isValidPassword = await bcrypt.compare(password, loadedUser.password);

    if (!isValidPassword) {
      return res.status(404).json({ msg: "password  not exsits" });
    }
    console.log("logged in succses");
    return res.status(200).json({
      userID: loadedUser.ID,
      name: loadedUser.name,
      token: generateAccessToken(loadedUser.id),
    });
  } catch {
    (err) => {
      return res.status(500).json({ msg: err });
    };
  }
};

exports.changePassword = async (req, res) => {
  console.log("changing password");
  const userID = req.body.userID;
  const oldPassword = req.body.oldPassword;
  const newPassword = req.body.newPassword;

  const loadedUser = await User.findOne({ ID: userID });

  if (!loadedUser) {
    return res.status(404).json("user not found");
  }

  const currPassword = loadedUser.password;

  const isValidPassword = await bcrypt.compare(oldPassword, currPassword);

  if (!isValidPassword) {
    return res.status(401).json("enterd the wrong current password");
  }
  if (newPassword) {
    const hashPassword = await bcrypt.hash(newPassword, 10);
    loadedUser.password = hashPassword;

    await loadedUser.save();
    return res.status(200).json("changed password");
  } else {
    return res.status(401).json("you did not enter a new password");
  }
};

function generateAccessToken(userID) {
  dotenv.config();
  let secret = process.env.JWT_SECRET;

  return jwt.sign({ userID }, process.env.JWT_SECRET, { expiresIn: "30 days" });
}

// console.log(generateAccessToken(12345));
