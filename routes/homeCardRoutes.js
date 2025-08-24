const express = require("express");
const { getCards, addCard } = require("../controllers/homeCardController");

const router = express.Router();

// All POST routes
router.post("/list", getCards);   // Get all home cards
router.post("/create", addCard);  // Add a home card

module.exports = router;
