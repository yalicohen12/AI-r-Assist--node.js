const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const filesSchema = new Schema({
  userID: {
    type: String,
  },
  fileID: {
    type: String,
  },
  fileName: {
    type: String,
  },
  link: {
    type: String,
  },
  timestamp: {
    type: String,
  },
  chatIndicator: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("File", filesSchema);
