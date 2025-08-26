// app.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const poemRoutes = require("./routes/poemRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const momentRoutes = require("./routes/momentsRoutes");
const videoRoutes = require("./routes/videoRoutes");
const countRoutes = require("./routes/countRoutes");

const app = express();

// ✅ Middleware
app.use(express.json());

// ✅ Allow frontend (localhost:3000) to access backend
app.use(
  cors({
    origin: ["https://mranalini.in"], // allow your frontend
    credentials: true, // allow cookies/auth headers
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Routes
app.use("/poems", poemRoutes);
app.use("/gallery", galleryRoutes);
app.use("/moments", momentRoutes);
app.use("/videos", videoRoutes);
app.use("/counts", countRoutes);

// ✅ MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ✅ Server running on correct port
const PORT = 9000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
