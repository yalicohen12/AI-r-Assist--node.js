const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middlewares/authMiddleware");

const usersController = require("../controllers/usersControllers");

router.post("/signup", usersController.signup);

router.post("/login", usersController.login);

router.post("/changePassword", authenticateToken, usersController.changePassword);

module.exports = router;
