const express = require("express");
const app = express();
const port = 3000;
const teamsRoutes = require("./routes/teamsRoutes");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

app.use(express.json());

app.use(cors());

app.use(teamsRoutes);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
