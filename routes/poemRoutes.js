const express = require("express");
const router = express.Router();
const poemController = require("../controllers/poemController");

// All routes are POST only
router.post("/list", poemController.getPoems);
router.post("/create", poemController.createPoem);
router.post("/update", poemController.updatePoem);
router.post("/delete", poemController.deletePoem);
router.post("/deleteMany", poemController.deleteManyPoems);

module.exports = router;
