const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = require("../db");
const Gallery = require("../models/Gallery");

// 🔹 Folder containing your images
const folderPath = path.join(__dirname, "images");

// 🔹 Bulk Upload Function
const bulkUpload = async () => {
  try {
    await connectDB(); // connect using db.js

    const files = fs.readdirSync(folderPath);

    const docs = files.map((file) => {
      // Read file and convert to Base64 string
      const filePath = path.join(folderPath, file);
      const fileData = fs.readFileSync(filePath);
      const base64Image = `data:image/${path.extname(file).slice(1)};base64,${fileData.toString("base64")}`;

      return {
        src: base64Image, // store as base64
        title: path.parse(file).name, // filename without extension
        caption: "Uploaded via bulk script",
      };
    });

    await Gallery.insertMany(docs);
    console.log("✅ Bulk upload successful:", docs.length, "images added");

    mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error during bulk upload:", err);
    mongoose.connection.close();
  }
};

bulkUpload();
