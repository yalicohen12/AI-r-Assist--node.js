const socketIo = require("socket.io");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const app = express();

const port = 4000;
const cors = require("cors");
app.use(express.json());
app.use(cors());

const conversationsRoutes = require("./routes/conversationsRoutes");
const usersRoutes = require("./routes/usersRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const foldersRoutes = require("./routes/foldersRoutes");
const filesRoutes = require("./routes/filesRoutes");

// connecting to DB
mongoose
  .connect("mongodb://localhost:27017/Ai-rAssistDB", {})
  .then(async (result) => {
    console.log("connected to mongodb");
  })
  .catch((err) => {
    console.log(err);
  });

// adding routes
app.use(usersRoutes);
app.use(conversationsRoutes);
app.use(departmentRoutes);
app.use(foldersRoutes);
app.use(filesRoutes);

// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });

// module.exports = server;

const server = http.createServer(app);

// const io = socketIo(server);
// io.use(cors());
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
