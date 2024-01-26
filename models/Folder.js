const mongoose = require("mongoose");
const Files = require("../models/File");

const Schema = mongoose.Schema;

const foldersSchema = new Schema({
  folderID: {
    type: String,
  },
  name: {
    type: String,
    required: true,
  },
  path: {
    type: String,
    required: true,
  },
  Files: {
    type: [Schema.Types.ObjectId],
    ref: "File",
  },
});

module.exports = mongoose.model("Folder", foldersSchema);
