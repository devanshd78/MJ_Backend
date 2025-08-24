// models/Gallery.js
const mongoose = require("mongoose");

const gallerySchema = new mongoose.Schema({
  src: { type: String, required: true }, // base64 string or image URL
  title: { type: String, required: true },
  caption: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Gallery", gallerySchema);
