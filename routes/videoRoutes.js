// routes/videoRoutes.js
const express = require("express");
const { GridFsStorage } = require("multer-gridfs-storage");
const multer = require("multer");
const mongoose = require("mongoose");
const {
  createVideo,
  getVideos,
  streamVideo,
  updateVideo,
  deleteVideo,
  deleteManyVideos,
} = require("../controllers/videoController");

const router = express.Router();

// Create a streaming storage that writes straight to GridFS (no memory buffers)
const storage = new GridFsStorage({
  url: process.env.MONGODB_URI,
  file: (req, file) => {
    // You can validate mime types here if needed
    return {
      filename: req.body?.filename || file.originalname,
      bucketName: "videos",
      metadata: {
        // you can store any custom fields here
        uploadedBy: req.user?._id || null,
        contentType: file.mimetype,
      },
      contentType: file.mimetype,
    };
  },
});
const upload = multer({ storage });

// REST routes
router.post("/create", upload.single("video"), createVideo);
router.post("/list", getVideos);
router.post("/update", upload.single("video"), updateVideo);
router.post("/delete", deleteVideo);
router.post("/deleteMany", deleteManyVideos);

// Byte-range streaming route
router.get("/stream/:id", streamVideo);

module.exports = router;
