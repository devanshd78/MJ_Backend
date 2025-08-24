// controllers/momentController.js
const mongoose = require("mongoose");
const Moment = require("../models/Moments");
const { getBucket } = require("../gridfs");

// use mongoose's ObjectId consistently
const toId = (id) => {
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
};

// helper for GridFS deletion (accepts string or ObjectId)
const toBucketId = (id) => {
  if (!id) return null;
  const hex = id?.toHexString ? id.toHexString() : String(id);
  return new mongoose.Types.ObjectId(hex);
};

/** CREATE */
exports.createMoment = async (req, res) => {
  try {
    const { type, title, date, body, tags, meta } = req.body || {};
    if (!type || !title || !date) {
      return res.status(400).json({ message: "type, title, date are required" });
    }

    const doc = {
      type,
      title,
      date: new Date(date),
      tags: Array.isArray(tags) ? tags : [],
      meta: meta && typeof meta === "object" ? meta : undefined,
    };

    if (type === "image" || type === "video") {
      if (!req.file) {
        return res.status(400).json({ message: "No media file uploaded" });
      }
      const isVideo = /^video\//.test(req.file.mimetype);
      const isImage = /^image\//.test(req.file.mimetype);
      const bucket = isVideo ? "mVideos" : isImage ? "images" : null;
      if (!bucket) {
        return res.status(400).json({ message: "Unsupported content type for media" });
      }
      const fileIdStr = req.file.id?.toHexString?.() || String(req.file.id);
      doc.media = {
        bucket,
        fileId: fileIdStr, // <-- store as string
        filename: req.file.filename,
        contentType: req.file.mimetype,
        length: req.file.size,
      };
    } else {
      doc.body = typeof body === "string" ? body : "";
    }

    const created = await Moment.create(doc);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ message: "Error creating moment", error: err.message });
  }
};

/** LIST (POST) */
exports.getMoments = async (req, res) => {
  try {
    let { page = 1, limit = 4, type, from, to, sort = "desc" } = req.body || {};
    page = Math.max(parseInt(page) || 1, 1);

    // If limit is blank (undefined/null/""), or explicitly "all", return all
    const wantAll =
      limit === undefined ||
      limit === null ||
      (typeof limit === "string" && limit.trim() === "") ||
      String(limit).toLowerCase() === "all";

    let parsedLimit = null;
    if (!wantAll) {
      parsedLimit = parseInt(limit);
      if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) parsedLimit = 12;
      parsedLimit = Math.min(Math.max(parsedLimit, 1), 100); // keep reasonable cap
    }

    const query = {};
    if (type && ["image", "video", "poem", "note"].includes(type)) query.type = type;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    const sortStage = { date: sort === "desc" ? 1 : -1 };

    // Build the base find query
    let findQ = Moment.find(query).sort(sortStage);
    if (!wantAll) {
      findQ = findQ.skip((page - 1) * parsedLimit).limit(parsedLimit);
    }

    const [items, total] = await Promise.all([findQ.lean(), Moment.countDocuments(query)]);

    // build absolute or relative URLs
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host");
    const base = `${proto}://${host}${req.baseUrl || ""}`.replace(/\/$/, "");

    const shaped = items.map((it) => {
      // hide body for non-text
      if (!["poem", "note"].includes(it.type)) delete it.body;

      // attach a media URL if present
      if (it.media?.bucket && it.media?.fileId) {
        it.mediaUrl = `/moments/media/${it.media.bucket}/${it.media.fileId}`; // bucket can be "images" or "mVideos"
        it.mediaUrlAbsolute = `${base}${it.mediaUrl}`;
      }
      return it;
    });

    const pageSize = shaped.length;
    const hasNext = wantAll ? false : page * parsedLimit < total;

    res.status(200).json({
      success: true,
      page: wantAll ? 1 : page,
      pageSize,
      total,
      hasNext,
      data: shaped,
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching moments", error: err.message });
  }
};

/** UPDATE */
exports.updateMoment = async (req, res) => {
  try {
    const { id, type, title, date, body, tags, meta } = req.body || {};
    const _id = toId(id);
    if (!_id) return res.status(400).json({ message: "Invalid id" });

    const existing = await Moment.findById(_id);
    if (!existing) return res.status(404).json({ message: "Moment not found" });

    const update = {};
    if (type && ["image", "video", "poem", "note"].includes(type)) update.type = type;
    if (title) update.title = title;
    if (date) update.date = new Date(date);
    if (Array.isArray(tags)) update.tags = tags;
    if (meta && typeof meta === "object") update.meta = { ...(existing.meta || {}), ...meta };

    // Handle file replacement for media types
    if (req.file) {
      const isVideo = /^video\//.test(req.file.mimetype);
      const isImage = /^image\//.test(req.file.mimetype);
      const bucket = isVideo ? "mVideos" : isImage ? "images" : null;
      if (!bucket) return res.status(400).json({ message: "Unsupported content type for media" });

      // delete old file
      if (existing.media?.fileId && existing.media.bucket) {
        try {
          await getBucket(existing.media.bucket).delete(toBucketId(existing.media.fileId));
        } catch { }
      }

      const fileIdStr = req.file.id?.toHexString?.() || String(req.file.id);
      update.media = {
        bucket,
        fileId: fileIdStr, // <-- string
        filename: req.file.filename,
        contentType: req.file.mimetype,
        length: req.file.size,
      };
      if (!update.type) update.type = isVideo ? "video" : "image";
      update.$unset = { ...(update.$unset || {}), body: "" };
    } else if (type === "poem" || type === "note") {
      update.body = typeof body === "string" ? body : existing.body || "";
      // if switching from media -> text, remove GridFS file
      if (existing.media?.fileId && existing.media.bucket) {
        try {
          await getBucket(existing.media.bucket).delete(toBucketId(existing.media.fileId));
        } catch { }
      }
      update.media = undefined;
    }

    const updated = await Moment.findByIdAndUpdate(_id, update, { new: true });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ message: "Error updating moment", error: err.message });
  }
};

/** DELETE (single) */
exports.deleteMoment = async (req, res) => {
  try {
    const _id = toId(req.body?.id);
    if (!_id) return res.status(400).json({ message: "Invalid id" });

    const doc = await Moment.findByIdAndDelete(_id);
    if (!doc) return res.status(404).json({ message: "Moment not found" });

    // clean up GridFS media
    if (doc.media?.fileId && doc.media.bucket) {
      try {
        await getBucket(doc.media.bucket).delete(toBucketId(doc.media.fileId));
      } catch { }
    }

    res.status(200).json({ success: true, message: "Moment deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting moment", error: err.message });
  }
};

/** DELETE MANY */
exports.deleteManyMoments = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    if (!ids || ids.length === 0) {
      return res.status(400).json({ message: "Provide an array of ids" });
    }
    const objectIds = ids.map(toId).filter(Boolean);
    const docs = await Moment.find({ _id: { $in: objectIds } });

    // delete docs first
    await Moment.deleteMany({ _id: { $in: objectIds } });

    // best-effort delete media
    await Promise.all(
      docs.map(async (d) => {
        if (d.media?.fileId && d.media.bucket) {
          try {
            await getBucket(d.media.bucket).delete(toBucketId(d.media.fileId));
          } catch { }
        }
      })
    );

    res.status(200).json({ success: true, message: "Moments deleted", count: objectIds.length });
  } catch (err) {
    res.status(500).json({ message: "Error deleting moments", error: err.message });
  }
};

exports.streamMedia = async (req, res) => {
  try {
    const { bucket, id } = req.params;
    if (!["images", "mVideos", "files"].includes(bucket)) {
      return res.status(400).json({ message: "Invalid bucket" });
    }
    const _id = toBucketId(id);
    if (!_id) return res.status(400).json({ message: "Invalid file id" });

    // fetch file doc to set headers
    const filesCol = mongoose.connection.db.collection(`${bucket}.files`);
    const fileDoc = await filesCol.findOne({ _id });
    if (!fileDoc) return res.status(404).json({ message: "File not found" });

    res.set("Content-Type", fileDoc.contentType || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=31536000, immutable");

    // simple stream (no range). If you need video seeking, add Range support.
    const readStream = getBucket(bucket).openDownloadStream(_id);
    readStream.on("error", () => res.status(404).end());
    readStream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: "Error streaming media", error: err.message });
  }
};
