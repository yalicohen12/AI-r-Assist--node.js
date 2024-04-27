const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const conversationSchema = new Schema({
  user: {
    ID: String,
  },
  conversationID: {
    type: String,
  },
  questions: {
    type: Array,
  },
  answers: {
    type: Array,
  },
  memory: {
    type: Array,
  },
  fileID: {
    type: String,
    default: "",
  },
  title: {
    type: String,
  },
  timestamp: {
    type: Date,
  },
  memorySize: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("Conversation", conversationSchema);
