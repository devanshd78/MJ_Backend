// debson.js
function deBsonify(obj) {
  if (obj == null || typeof obj !== "object") return obj;
  if (typeof obj.toHexString === "function" && obj._bsontype === "ObjectId") {
    // Any ObjectId from any bson -> string
    return obj.toHexString();
  }
  if (obj._bsontype && typeof obj.toString === "function") {
    // Fallback for other BSON instances
    return obj.toString();
  }
  if (Array.isArray(obj)) return obj.map(deBsonify);
  for (const k of Object.keys(obj)) obj[k] = deBsonify(obj[k]);
  return obj;
}
module.exports = { deBsonify };
