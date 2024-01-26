const mongoose = require("mongoose");
const Folder = require("../models/Folder");
const User = require("../models/User");
const Schema = mongoose.Schema;

const departmentsSchema = new Schema({
  departmentID: {
    type: String,
  },
  name: {
    type: String,
    required: true,
  },
  owner: {
    type: [Schema.Types.ObjectId],
    fef: "User",
  },
  folders: {
    type: [Schema.Types.ObjectId],
    ref: "Folder",
  },
  code: {
    type: Number,
  },
});

module.exports = mongoose.model("Department", departmentsSchema);
