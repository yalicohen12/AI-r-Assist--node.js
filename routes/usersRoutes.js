const express = require("express");
const router = express.Router();

const usersController = require("../controllers/usersControllers");

router.post("/signup", usersController.signup);

router.post("/login", usersController.login);

router.post("/changePassword", usersController.changePassword);

module.exports = router;
