// models/homecards.model.js
const mongoose = require("mongoose");

const homeCardSchema = new mongoose.Schema({
  href: { type: String, required: true },
  title: { type: String, required: true },
  desc: { type: String, required: true },
  icon: { type: String, required: true }, // Save icon name as string
}, { timestamps: true });

module.exports = mongoose.model("HomeCards", homeCardSchema);
