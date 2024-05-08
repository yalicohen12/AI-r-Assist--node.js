const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

exports.authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) {
      console.log("no token");
      return res.status(401).json("no token");
    }

    const decoded = jwt.verify(token, "10a859c40a46bbb4d5d51995241eec8f6b7a90415e");

    // if (req.body.userID != decoded.userID) {
    //   console.log(" token to userID mismatch");
    // } else {
    //   console.log(" token to userID match");
    // }

    next();
  } catch (error) {
    console.log(error);
    res.status(402).json(error);
  }
};
