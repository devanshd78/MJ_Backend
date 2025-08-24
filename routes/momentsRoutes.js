// routes/momentRoutes.js
const express = require("express");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");

const {
  createMoment,
  getMoments,
  updateMoment,
  deleteMoment,
  deleteManyMoments,
  streamMedia,      
} = require("../controllers/momentsController");

const router = express.Router();

/** storage that writes directly to GridFS (no RAM buffers) */
const storage = new GridFsStorage({
  // Return the native Db *after* Mongoose is connected
  url: process.env.MONGODB_URI,
  file: (req, file) => {
    const isVideo = /^video\//.test(file.mimetype);
    const isImage = /^image\//.test(file.mimetype);
    const bucketName = isVideo ? "mVideos" : isImage ? "images" : "files";
    return {
      filename: req.body?.filename || file.originalname,
      bucketName,
      contentType: file.mimetype,
      metadata: {
        kind: bucketName,
        uploadedBy: req.user?._id || null,
      },
    };
  },
});
const upload = multer({ storage });

// POST-only API
router.post("/create", upload.single("file"), createMoment);
router.post("/list", getMoments);
router.post("/update", upload.single("file"), updateMoment);
router.post("/delete", deleteMoment);
router.post("/deleteMany", deleteManyMoments);
router.get("/media/:bucket/:id", streamMedia);

module.exports = router;
