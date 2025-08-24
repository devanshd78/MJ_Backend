const mongoose = require("mongoose");
const { getBucket } = require("../gridfs");

// Helper: build consistent ETag (doesn’t depend on MD5 availability)
const buildETag = (file) =>
    `"${file._id.toString()}-${file.length}-${new Date(file.uploadDate).getTime()}"`;

const toId = (id) => {
  try { return new mongoose.Types.ObjectId(id); }
  catch { return null; }
};

// Upload (already stored by multer-gridfs-storage)
exports.createVideo = async (req, res) => {
    try {
        // multer-gridfs-storage puts file info on req.file
        if (!req.file) return res.status(400).json({ message: "No video file uploaded" });

        const f = req.file; // includes id, filename, size, contentType, metadata, etc.
        return res.status(201).json({
            message: "Video uploaded successfully",
            file: {
                _id: f.id,
                filename: f.filename,
                length: f.size,              // bytes
                contentType: f.contentType,
                uploadDate: new Date(),      // storage sets this internally; return now for UX
                metadata: f.metadata || {},
            },
        });
    } catch (err) {
        res.status(500).json({ message: "Error uploading video", error: err.message });
    }
};

// List metadata (paginated, no blobs)
exports.getVideos = async (req, res) => {
    try {
        const bucket = getBucket();
        let { page = 1, limit = 12, sort = "desc" } = req.body || {};
        page = Math.max(parseInt(page) || 1, 1);
        limit = Math.min(Math.max(parseInt(limit) || 12, 1), 100); // cap page size

        const skip = (page - 1) * limit;
        const sortStage = { uploadDate: sort === "asc" ? 1 : -1 };

        // Only return light metadata
        const projection = {
            filename: 1,
            length: 1,
            uploadDate: 1,
            contentType: 1,
            metadata: 1,
        };

        const filesColl = bucket.s.db.collection(`${bucket.s.options.bucketName}.files`);
        const [items, total] = await Promise.all([
            bucket.find({}, { sort: sortStage, skip, limit, projection }).toArray(),
            filesColl.countDocuments({}),
        ]);

        res.status(200).json({
            success: true,
            page,
            pageSize: items.length,
            total,
            hasNext: skip + items.length < total,
            data: items.map((f) => ({
                _id: f._id,
                filename: f.filename,
                length: f.length,
                uploadDate: f.uploadDate,
                contentType: f.contentType,
                metadata: f.metadata || {},
            })),
        });
    } catch (err) {
        res.status(500).json({ message: "Error fetching videos", error: err.message });
    }
};

// Byte-range & cached streaming
exports.streamVideo = async (req, res) => {
    try {
        const bucket = getBucket();
        const id = toId(req.params.id);
        if (!id) return res.status(400).json({ message: "Invalid id" });

        const file = await bucket.find({ _id: id }).next();
        if (!file) return res.status(404).json({ message: "Video not found" });

        const total = file.length;
        const contentType = file.contentType || file.metadata?.contentType || "application/octet-stream";
        const etag = buildETag(file);
        const lastModified = new Date(file.uploadDate).toUTCString();

        // Conditional GET
        if (req.headers["if-none-match"] === etag || req.headers["if-modified-since"] === lastModified) {
            res.status(304).end();
            return;
        }

        // Parse Range header
        const range = req.headers.range;
        let start = 0;
        let end = total - 1;
        let statusCode = 200;

        if (range) {
            const match = range.match(/bytes=(\d*)-(\d*)/);
            if (match) {
                const s = match[1] ? parseInt(match[1], 10) : 0;
                const e = match[2] ? parseInt(match[2], 10) : end;
                if (!Number.isNaN(s) && !Number.isNaN(e) && s <= e) {
                    start = Math.max(0, s);
                    end = Math.min(e, total - 1);
                    statusCode = 206;
                }
            }
        }

        const chunkSize = end - start + 1;

        res.status(statusCode);
        res.set({
            "Content-Type": contentType,
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
            "ETag": etag,
            "Last-Modified": lastModified,
        });
        if (statusCode === 206) {
            res.set("Content-Range", `bytes ${start}-${end}/${total}`);
            res.set("Content-Length", chunkSize);
        } else {
            res.set("Content-Length", total);
        }

        // GridFS 'end' is exclusive; use end + 1
        const download = bucket.openDownloadStream(id, { start, end: end + 1 });
        download.on("error", (e) => {
            res.status(500).end();
        });
        download.pipe(res);
    } catch (err) {
        res.status(500).json({ message: "Error streaming video", error: err.message });
    }
};

// Update: rename/metadata OR replace content (re-upload new file), still all in MongoDB
exports.updateVideo = async (req, res) => {
    try {
        const bucket = getBucket();
        const { id, filename, metadata } = req.body || {};
        const _id = toId(id);
        if (!_id) return res.status(400).json({ message: "Invalid id" });

        const filesColl = bucket.s.db.collection(`${bucket.s.options.bucketName}.files`);
        const file = await filesColl.findOne({ _id });
        if (!file) return res.status(404).json({ message: "Video not found" });

        // If a new file was uploaded, we replace content by:
        // 1) upload new
        // 2) delete old
        if (req.file) {
            const newId = req.file.id;
            // Copy over friendly filename if client did not set it on upload
            if (filename) {
                await filesColl.updateOne({ _id: newId }, { $set: { filename } });
            }
            // Delete old content
            await bucket.delete(_id);
            return res.status(200).json({
                message: "Video content replaced successfully",
                file: {
                    _id: newId,
                    filename: filename || req.file.filename,
                    length: req.file.size,
                    contentType: req.file.contentType,
                    uploadDate: new Date(),
                    metadata: req.file.metadata || {},
                },
            });
        }

        // Otherwise, just update filename/metadata in place
        const updateOps = {};
        if (filename) updateOps.filename = filename;
        if (metadata && typeof metadata === "object") {
            updateOps.metadata = { ...(file.metadata || {}), ...metadata };
        }

        if (Object.keys(updateOps).length === 0) {
            return res.status(400).json({ message: "Nothing to update" });
        }

        await filesColl.updateOne({ _id }, { $set: updateOps });
        const updated = await filesColl.findOne({ _id });
        res.status(200).json({
            message: "Video updated successfully",
            file: {
                _id: updated._id,
                filename: updated.filename,
                length: updated.length,
                contentType: updated.contentType,
                uploadDate: updated.uploadDate,
                metadata: updated.metadata || {},
            },
        });
    } catch (err) {
        res.status(500).json({ message: "Error updating video", error: err.message });
    }
};

// Delete single
exports.deleteVideo = async (req, res) => {
    try {
        const bucket = getBucket();
        const _id = toId(req.body?.id);
        if (!_id) return res.status(400).json({ message: "Invalid id" });

        await bucket.delete(_id);
        res.status(200).json({ message: "Video deleted successfully" });
    } catch (err) {
        // bucket.delete throws if not found
        if (err && String(err).includes("FileNotFound")) {
            return res.status(404).json({ message: "Video not found" });
        }
        res.status(500).json({ message: "Error deleting video", error: err.message });
    }
};

// Delete many
exports.deleteManyVideos = async (req, res) => {
    try {
        const bucket = getBucket();
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
        if (!ids || ids.length === 0) {
            return res.status(400).json({ message: "Please provide an array of ids" });
        }
        const objectIds = ids.map(toId).filter(Boolean);
        await Promise.all(objectIds.map((_id) => bucket.delete(_id).catch(() => null)));
        res.status(200).json({ message: "Videos deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting videos", error: err.message });
    }
};