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
  },
  title: {
    type: String,
  },
  timestamp: {
    type: Date,
  },
});

module.exports = mongoose.model("Conversation", conversationSchema);
