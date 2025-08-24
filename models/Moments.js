// models/Moment.js
const mongoose = require("mongoose");

const fileRefSchema = new mongoose.Schema(
  {
    bucket: { type: String, enum: ["images", "mVideos"], required: true },
    fileId: { type: String, required: true },
    filename: String,
    contentType: String,
    length: Number,
  },
  { _id: false }
);

const momentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["image", "video", "poem", "note"], required: true },
    date: { type: Date, required: true }, // <-- use Date, not year
    title: { type: String, required: true },
    body: { type: String },               // poem/note text
    media: fileRefSchema,                 // image/video GridFS reference (single)
    tags: [{ type: String }],
    meta: { type: Object },               // any extra (e.g., width/height, duration)
  },
  { timestamps: true }
);

// helpful indexes
momentSchema.index({ date: -1 });
momentSchema.index({ type: 1, date: -1 });

module.exports = mongoose.model("Moment", momentSchema);
