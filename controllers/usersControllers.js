const User = require("../models/User");
const mongoose = require("mongoose");

exports.signup = async (req, res) => {
  try {
    const name = req.body.name;
    const isUsernameUnique = await User.findOne({ name });

    if (isUsernameUnique) {
      return res.status(409).json("user name already exsits");
    }
    const password = req.body.password;

    const userID = new mongoose.Types.ObjectId();

    const user = new User({
      ID: userID,
      name: name,
      password: password,
    });

    user.save();
    console.log("Created user");
    return res.status(200).json({ userID: userID, name: name });
  } catch {
    (err) => {
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

    const loadedUser = await User.findOne({ name: name , password:password });
    // console.log(loadedUser);

    if (!loadedUser) {
      return res.status(404).json({ msg: "name or password are not exsits" });
    }
    console.log("logged in succses")
    return res
      .status(200)
      .json({ userID: loadedUser.ID, name: loadedUser.name });
  } catch {
    (err) => {
      return res.status(500).json({ msg: err });
    };
  }
};
