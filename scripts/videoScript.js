require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Video = require("../models/Video");

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch((err) => console.error("❌ DB Error:", err));

const uploadVideos = async () => {
  try {
    const folderPath = path.join(__dirname, "videos"); // folder with all videos
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const fileData = fs.readFileSync(filePath);

      const newVideo = new Video({
        filename: file,
        data: fileData,
        contentType: `video/${path.extname(file).slice(1)}` // e.g., video/mp4
      });

      await newVideo.save();
      console.log(`✅ Uploaded: ${file}`);
    }

    console.log("🎉 All videos uploaded successfully!");
    mongoose.connection.close();
  } catch (err) {
    console.error("❌ Upload error:", err);
    mongoose.connection.close();
  }
};

uploadVideos();
