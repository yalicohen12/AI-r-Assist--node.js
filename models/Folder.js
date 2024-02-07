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
  link: {
    type: String,
    required: true,
  },
  files: {
    type: [Schema.Types.ObjectId],
    ref: "File",
  },
});

module.exports = mongoose.model("Folder", foldersSchema);
