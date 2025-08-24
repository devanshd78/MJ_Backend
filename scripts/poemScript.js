// seed.js
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../db");
const Poem = require("../models/Poem");

// Import your poems data
const { POEMS } = require("./poems");

const seedData = async () => {
  try {
    await connectDB();

    // Clear old data (optional)
    await Poem.deleteMany({});
    console.log("🗑️ Old poems deleted");

    // Insert new poems
    await Poem.insertMany(POEMS);
    console.log("✅ Poems inserted successfully");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding data:", err.message);
    process.exit(1);
  }
};

seedData();
