const express = require("express");
const router = express.Router();
const galleryController = require("../controllers/galleryController");

router.post("/create", galleryController.createImage);
router.post("/update", galleryController.updateImage);
router.post("/list", galleryController.getList);
router.post("/delete", galleryController.deleteImage);
router.post("/delete-many", galleryController.deleteMany);

module.exports = router;
