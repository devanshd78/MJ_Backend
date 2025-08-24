// app.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const poemRoutes = require("./routes/poemRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const momentRoutes = require("./routes/momentsRoutes");
const videoRoutes = require("./routes/videoRoutes");
const homeCardRoutes = require("./routes/homeCardRoutes");
const countRoutes = require("./routes/countRoutes");

const app = express();

// ✅ Middleware
app.use(express.json());

// ✅ Allow frontend (localhost:3000) to access backend
app.use(
  cors({
    origin: ["http://localhost:3000"], // allow your frontend
    credentials: true, // allow cookies/auth headers
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Routes
app.use("/api/poems", poemRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/moments", momentRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/homecards", homeCardRoutes);
app.use("/api/counts", countRoutes);

// ✅ MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ✅ Server running on correct port
const PORT = 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
