// poem.model.js
const mongoose = require("mongoose");

const poemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  lines: { type: [String], required: true },
});

module.exports = mongoose.model("Poem", poemSchema);
