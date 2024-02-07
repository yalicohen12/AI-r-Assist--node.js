const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const filesSchema = new Schema({
  fileID: {
    type: String,
  },
  fileName: {
    type: String,
  },
  link: {
    type: String,
  },
  owner: {
    type: String,
  },
  timestamp: {
    type: String,
  },
});

module.exports = mongoose.model("File", filesSchema);
