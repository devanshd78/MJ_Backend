// controllers/poem.controller.js
const Poem = require("../models/Poem");

// ✅ Get list of poems (POST /api/poems/list)
exports.getPoems = async (req, res) => {
  try {
    const poems = await Poem.find();
    res.status(200).json({
      success: true,
      message: "Poems fetched successfully",
      data: poems,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching poems",
      error: error.message,
    });
  }
};

// ✅ Create new poem (POST /api/poems/create)
exports.createPoem = async (req, res) => {
  try {
    const { title, lines } = req.body;

    if (!title?.trim() || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Title and at least one line are required",
      });
    }

    const newPoem = await Poem.create({
      title: title.trim(),
      lines: lines.map((line) => line.trim()).filter(Boolean),
    });

    res.status(201).json({
      success: true,
      message: "Poem created successfully",
      data: newPoem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating poem",
      error: error.message,
    });
  }
};

// ✅ Update poem by ID (POST /api/poems/update)
exports.updatePoem = async (req, res) => {
  try {
    const { id, title, lines } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Poem ID required" });
    }

    const updatedPoem = await Poem.findByIdAndUpdate(
      id,
      { title, lines },
      { new: true, runValidators: true }
    );

    if (!updatedPoem) {
      return res.status(404).json({ success: false, message: "Poem not found" });
    }

    res.status(200).json({
      success: true,
      message: "Poem updated successfully",
      data: updatedPoem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating poem",
      error: error.message,
    });
  }
};

// ✅ Delete poem by ID (POST /api/poems/delete)
exports.deletePoem = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Poem ID required" });
    }

    const deletedPoem = await Poem.findByIdAndDelete(id);

    if (!deletedPoem) {
      return res.status(404).json({ success: false, message: "Poem not found" });
    }

    res.status(200).json({ success: true, message: "Poem deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting poem",
      error: error.message,
    });
  }
};

// ✅ Delete multiple poems (POST /api/poems/deleteMany)
exports.deleteManyPoems = async (req, res) => {
  try {
    const { ids } = req.body; // array of poem IDs

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "IDs array required" });
    }

    await Poem.deleteMany({ _id: { $in: ids } });

    res.status(200).json({ success: true, message: "Poems deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting poems",
      error: error.message,
    });
  }
};
