const HomeCard = require("../models/HomeCard");

const getCards = async (req, res) => {
  try {
    const data = await HomeCard.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addCard = async (req, res) => {
  try {
    const { title, description, image } = req.body;
    const newCard = new HomeCard({ title, description, image });
    await newCard.save();
    res.json(newCard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getCards, addCard };
