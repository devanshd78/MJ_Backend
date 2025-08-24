// gridfs.js
const mongoose = require("mongoose");

const bucketCache = new Map();
let DEFAULT_BUCKET_NAME = "videos";

function ensureConnected() {
  if (!mongoose.connection?.db) {
    throw new Error("Mongoose is not connected yet.");
  }
}

function getBucket(name) {
  ensureConnected();
  const bucketName = (name && String(name)) || DEFAULT_BUCKET_NAME;

  if (!bucketCache.has(bucketName)) {
    // ✅ use the SAME driver instance that Mongoose uses
    const { GridFSBucket } = mongoose.mongo;
    bucketCache.set(bucketName, new GridFSBucket(mongoose.connection.db, { bucketName }));
  }
  return bucketCache.get(bucketName);
}

function setDefaultBucketName(name) {
  if (name) DEFAULT_BUCKET_NAME = String(name);
}

async function initGridFS(options = {}) {
  if (options.defaultBucketName) setDefaultBucketName(options.defaultBucketName);
  getBucket(DEFAULT_BUCKET_NAME); // prewarm
  return getBucket(DEFAULT_BUCKET_NAME);
}

if (mongoose.connection && mongoose.connection.on) {
  mongoose.connection.on("disconnected", () => bucketCache.clear());
}

module.exports = { getBucket, initGridFS, setDefaultBucketName };
