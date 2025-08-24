#!/usr/bin/env node
/**
 * Migrate legacy "videos" collection (buffer blobs) to GridFS.
 *
 * Examples:
 *   node scripts/migrate-videos.js --uri="mongodb+srv://..." --db="mydb"
 *   node scripts/migrate-videos.js --uri="mongodb://localhost:27017" --db="mydb" --source=videos --bucket=videos --logEvery=10
 *   node scripts/migrate-videos.js --uri="..." --db="mydb" --fixContentTypes   # patch existing GridFS files
 *
 * Env fallbacks:
 *   MONGODB_URI / MONGO_URI
 *   MONGODB_DBNAME
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const mime = require('mime-types');
const { argv } = require('node:process');

// ---------- CLI args ----------
const args = Object.fromEntries(
  argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

const parseBool = (v, def = false) => {
  if (v === undefined || v === null || v === '') return def;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase().trim();
  if (['1','true','t','yes','y','on'].includes(s)) return true;
  if (['0','false','f','no','n','off'].includes(s)) return false;
  return def;
};

const uri = args.uri || process.env.MONGODB_URI || process.env.MONGO_URI;
const dbName = args.db || process.env.MONGODB_DBNAME || undefined;
const sourceCol = args.source || 'videos';    // legacy buffer collection
const bucketName = args.bucket || 'videos';   // GridFS bucket to write into
const dryRun = parseBool(args.dry, false);
const skipExisting = parseBool(args.skipExisting, true);
const logEvery = Number.isFinite(Number(args.logEvery)) ? Math.max(1, Number(args.logEvery)) : 25;
const fixContentTypesOnly = parseBool(args.fixContentTypes, false);

if (!uri || typeof uri !== 'string') {
  console.error('❌ Missing MongoDB connection string. Use --uri="..." or MONGODB_URI');
  process.exit(1);
}

// Fatal on unhandled rejections (surface hidden issues)
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Promise rejection:', reason);
  process.exit(1);
});

// Graceful shutdown
let shuttingDown = false;
const handleSignal = (sig) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.warn(`\n⚠️  Received ${sig}. Attempting graceful shutdown...`);
  mongoose.disconnect().finally(() => {
    console.warn('🔌 Disconnected. Exiting.');
    process.exit(1);
  });
};
process.on('SIGINT', () => handleSignal('SIGINT'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));

(async function main() {
  console.log(`🔗 Connecting to MongoDB${dbName ? ` db="${dbName}"` : ''}...`);
  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 60000,
    maxPoolSize: 10,
  });

  const db = mongoose.connection.db;

  // Use Mongoose's driver for GridFS (consistent with app)
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName });

  const filesColl  = db.collection(`${bucketName}.files`);
  const chunksColl = db.collection(`${bucketName}.chunks`);

  // ---------- Ensure GridFS indexes ----------
  console.log('🛠  Ensuring GridFS indexes...');
  await chunksColl.createIndex({ files_id: 1, n: 1 }, { unique: true });
  await filesColl.createIndex({ filename: 1, uploadDate: 1 });

  if (fixContentTypesOnly) {
    console.log('🧯 Fixing/normalizing contentType on existing GridFS files...');
    const cur = filesColl.find(
      { $or: [{ contentType: { $exists: false } }, { contentType: '' }] },
      { projection: { _id: 1, filename: 1, metadata: 1 } }
    );

    let fixed = 0, scanned = 0;
    while (await cur.hasNext()) {
      const f = await cur.next(); scanned++;
      const guess = f.metadata?.contentType || (f.filename && mime.lookup(f.filename)) || 'video/mp4';
      await filesColl.updateOne({ _id: f._id }, { $set: { contentType: guess } });
      fixed++;
      if (fixed % logEvery === 0) console.log(`✔︎ Fixed ${fixed} so far...`);
    }
    console.log(`✅ Done. Scanned: ${scanned}, Fixed: ${fixed}.`);
    await mongoose.disconnect();
    return;
  }

  // ---------- Legacy model (buffer storage) ----------
  const legacySchema = new mongoose.Schema(
    {
      filename: { type: String, required: true },
      data: { type: Buffer, required: true },
      contentType: { type: String },                 // optional in some old docs
      createdAt: { type: Date },                     // if you had timestamps
      updatedAt: { type: Date },
    },
    { collection: sourceCol }
  );
  const LegacyVideo = mongoose.models.VideoLegacy || mongoose.model('VideoLegacy', legacySchema);

  const total = await LegacyVideo.countDocuments();
  console.log(`🔎 Found ${total} legacy docs in '${sourceCol}' to migrate into GridFS bucket '${bucketName}' ${dryRun ? '(dry run)' : ''}`);

  if (total === 0) {
    console.log('ℹ️  Nothing to migrate.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Optional smoke-test upload to verify permissions & bucket
  console.log('🧪 GridFS smoke test...');
  const smoke = bucket.openUploadStream(`__gridfs_smoke__${Date.now()}.txt`, { metadata: { smoke: true } });
  await new Promise((resolve, reject) => {
    smoke.once('finish', resolve);
    smoke.once('error', reject);
    smoke.end(Buffer.from('ok'));
  });
  try { await bucket.delete(smoke.id); } catch (_) {}
  console.log('✅ GridFS smoke test passed.');

  let migrated = 0, skipped = 0, failed = 0, processed = 0;

  const cursor = LegacyVideo.find().cursor();
  for await (const doc of cursor) {
    if (shuttingDown) break;
    processed++;

    if (!doc || !Buffer.isBuffer(doc.data) || doc.data.length === 0) {
      console.warn(`⚠️  Skipping ${doc?._id ?? '(unknown id)'} (no valid data)`);
      skipped++;
      continue;
    }

    const legacyId = doc._id?.toString?.() ?? String(doc._id);
    const filename = doc.filename || `video-${legacyId}.mp4`;
    const guessedCT = doc.contentType || (filename && mime.lookup(filename)) || 'video/mp4';

    // Idempotency: already migrated?
    if (skipExisting && !dryRun) {
      const exists = await filesColl.findOne({ 'metadata.oldId': legacyId });
      if (exists) {
        // ensure contentType exists at root even if earlier run forgot it
        if (!exists.contentType) {
          await filesColl.updateOne({ _id: exists._id }, { $set: { contentType: guessedCT } });
        }
        const chunkCount = await chunksColl.countDocuments({ files_id: exists._id });
        if (chunkCount === 0) {
          console.warn(`↪︎ Had file doc but 0 chunks for oldId=${legacyId}. Re-migrating.`);
        } else {
          skipped++;
          if (processed % logEvery === 0) console.log(`… processed ${processed}/${total} (skipped=${skipped}, migrated=${migrated})`);
          continue;
        }
      }
    }

    if (dryRun) {
      migrated++;
      if (processed % logEvery === 0) console.log(`➡️ [dry] would migrate ${processed}/${total}`);
      continue;
    }

    try {
      // Upload to GridFS
      const upload = bucket.openUploadStream(filename, {
        contentType: guessedCT,                 // ✅ put on files.contentType
        metadata: {
          migratedFrom: 'Video',
          oldId: legacyId,
          oldFilename: doc.filename || null,
          // Optionally keep original timestamps as metadata
          legacyCreatedAt: doc.createdAt || null,
          legacyUpdatedAt: doc.updatedAt || null,
        },
      });

      await new Promise((resolve, reject) => {
        upload.once('finish', resolve);
        upload.once('error', reject);
        upload.end(doc.data);
      });

      // Double-ensure root contentType (some drivers/versions only set metadata)
      await filesColl.updateOne(
        { _id: upload.id },
        { $set: { contentType: guessedCT } }
      );

      // Verify chunks exist
      const chunkCount = await chunksColl.countDocuments({ files_id: upload.id });
      if (chunkCount === 0) {
        throw new Error('Uploaded files doc has 0 chunks — aborting this item');
      }

      migrated++;
      if (processed % logEvery === 0 || migrated === total) {
        console.log(`➡️  Migrated ${migrated}/${total} (processed ${processed})`);
      }
    } catch (e) {
      failed++;
      console.error(`❌  Failed to migrate legacyId=${legacyId}:`, e?.message || e);
    }
  }

  console.log('----------------------------------------');
  console.log(`✅ Done. Migrated: ${migrated}, Skipped: ${skipped}, Failed: ${failed}.`);
  console.log('----------------------------------------');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
})().catch(async (err) => {
  console.error('💥 Migration failed:', err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
