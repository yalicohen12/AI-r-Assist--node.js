const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const userSchema = new Schema({
  ID: {
    type: Schema.Types.ObjectId,
  },
  name: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  // role: {
  //   type: String,
  //   default: "user",
  // },
  dateOfAccountOpen: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
