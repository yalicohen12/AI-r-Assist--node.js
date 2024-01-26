const express = require("express");
const router = express.Router();

const departmentController = require("../controllers/departmentsController");

router.post("/createDepartment", departmentController.createDepartment);

module.exports = router;
