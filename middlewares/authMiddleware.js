const jwt = require("jsonwebtoken");

exports.authenticateToken = async (req, res, next) => {
  console.log("autheting");

  try {
    // console.log("valudate")
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      // Authorization header is missing
      console.log("No authorization header");
      return res.status(401).json("No authorization header");
    }

    // Split the Authorization header to get the token
    const token = authHeader.split(" ")[1];

    // console.log(authHeader)
    // console.log("trying to valid")

    // console.log(token)

    if (!token) {
      // Token is missing
      console.log("No token provided");
      return res.status(401).json("No token provided");
    }

    // Verify and decode the token
    const decoded = jwt.verify(
      token,
      "10a859c40a46bbb4d5d51995241eec8f6b7a90415e"
    );

    console.log("token approvel");

    next();
    
  } catch (error) {
    // Handle JWT errors
    console.log(error);
    if (error.name === "TokenExpiredError") {
      console.log("Token expired");
      return res
        .status(401)
        .json({ message: "Token expired, please log in again" });
    }
    else {
      res.status(401).json({ error: "Unauthorized" });
    }
  }
};
