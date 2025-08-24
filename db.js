// db.js
const mongoose = require("mongoose");
const { initGridFS } = require("./gridfs");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected");
    initGridFS();
  } catch (err) {
    console.error("❌ DB Connection Error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;