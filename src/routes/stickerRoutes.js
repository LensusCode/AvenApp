const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

router.get('/', async (req, res) => {
    try {
        const query = req.query.q;
        const limit = 20;

        let url;
        if (query) {
            url = `https://api.giphy.com/v1/stickers/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&offset=0&rating=g&lang=en`;
        } else {
            url = `https://api.giphy.com/v1/stickers/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&rating=g`;
        }

        const response = await axios.get(url);
        res.json(response.data);

    } catch (error) {
        console.error('Error en proxy de stickers:', error.message);
        res.status(500).json({ success: false, error: 'Error al obtener stickers' });
    }
});

module.exports = router;
