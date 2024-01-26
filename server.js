const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require("express");
const mongoose = require("mongoose");
const app = express();
const port = 4000;
const cors = require("cors");
app.use(express.json());
app.use(cors());
const conversationsRoutes = require("./routes/conversationsRoutes");
const usersRoutes = require("./routes/usersRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const foldersRoutes = require("./routes/foldersRoutes");

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
