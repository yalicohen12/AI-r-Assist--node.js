const express = require("express");
const router = express.Router();
const teamsController = require("../controllers/teamsController");
const mysql = require("mysql2");

// const db = mysql.createConnection({
//   host: "localhost",
//   user: "root",
//   password: "yali2004",
//   database: "testdb",
// });
const db = mysql.createConnection({
  host: "localhost",
  user: "yd3",
  password: "yd3",
  database: "testdb",
});

db.connect((err) => {
  if (err) {
    console.error("MySQL connection error:", err);
  } else {
    console.log("Connected to MySQL database");
  }
});

router.get("/getTeams", teamsController.getTeams(db));

router.post("/getPlayers", teamsController.getPlayers(db));

module.exports = router;
