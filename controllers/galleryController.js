const Gallery = require("../models/Gallery");

// Create new image
const createImage = async (req, res) => {
  try {
    const { src, title, caption } = req.body;
    const newImage = new Gallery({ src, title, caption });
    await newImage.save();
    res.json({ success: true, data: newImage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update image
const updateImage = async (req, res) => {
  try {
    const { id, src, title, caption } = req.body;
    const updatedImage = await Gallery.findByIdAndUpdate(
      id,
      { src, title, caption },
      { new: true }
    );
    if (!updatedImage) return res.status(404).json({ success: false, message: "Image not found" });
    res.json({ success: true, data: updatedImage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get list of images
const getList = async (req, res) => {
 try {
    const { limit } = req.body; // number of images to fetch
    const query = Gallery.find();

    if (limit && Number(limit) > 0) {
      query.limit(Number(limit)); // apply limit if provided
    }

    const images = await query.exec();

    res.status(200).json({
      success: true,
      count: images.length,   // number of images returned
      data: images,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching gallery images",
      error: error.message,
    });
  }
};

// Delete one image
const deleteImage = async (req, res) => {
  try {
    const { id } = req.body;
    const deleted = await Gallery.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "Image not found" });
    res.json({ success: true, message: "Image deleted", data: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete many images
const deleteMany = async (req, res) => {
  try {
    const { ids } = req.body; // Expect an array of ids
    const result = await Gallery.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `${result.deletedCount} images deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createImage,
  updateImage,
  getList,
  deleteImage,
  deleteMany,
};
