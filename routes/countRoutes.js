const express = require("express");
const router = express.Router();

// Import your models
const Poem = require("../models/Poem");
const Gallery = require("../models/Gallery");
const Moment = require("../models/Moments");
const Video = require("../models/Video");
const HomeCard = require("../models/HomeCard");

// POST /api/counts/list
const { getBucket } = require("../gridfs");

router.post("/list", async (req, res) => {
  try {
    const bucket = getBucket();
    const filesColl = bucket.s.db.collection(`${bucket.s.options.bucketName}.files`);

    const [poems, galleries, moments, videos, homeCards, lastGallery] = await Promise.all([
      Poem.countDocuments(),
      Gallery.countDocuments(),
      Moment.countDocuments(),
      filesColl.countDocuments({}), // ✅ count GridFS video files
      HomeCard.countDocuments(),
      Gallery.findOne({ title: "mj_smile" }).select("src")
    ]);

    res.json({
      poems,
      galleries,
      moments,
      videos, // now shows correct count
      homeCards,
      heroImg: lastGallery?.src || null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});


module.exports = router;
