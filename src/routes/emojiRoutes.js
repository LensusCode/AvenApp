const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

let emojiCache = null;

const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/LensusCode/animated-emojis/main';

router.get('/', (req, res) => {
    try {
        if (emojiCache) {
            return res.json({ success: true, data: emojiCache });
        }

        const manifestPath = path.join(__dirname, '../../public/emoji-manifest.json');

        if (!fs.existsSync(manifestPath)) {
            console.error('Manifiesto de emojis no encontrado:', manifestPath);
            return res.json({ success: true, data: {} });
        }

        // Leer el manifiesto directamente
        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestContent);

        const categories = {};

        // Transformar el manifiesto en la estructura de URLs de GitHub
        for (const [categoryName, files] of Object.entries(manifest)) {
            // Encode category name for URL (spaces to %20)
            const encodedCategory = encodeURIComponent(categoryName).replace(/%20/g, '%20');
            // encodeURIComponent handles spaces as %20 automatically but just to be explicit based on user request

            categories[categoryName] = files.map(filename => {
                const encodedFilename = encodeURIComponent(filename).replace(/%20/g, '%20');
                return `${GITHUB_BASE_URL}/${encodedCategory}/${encodedFilename}`;
            });
        }

        emojiCache = categories;
        res.json({ success: true, data: categories });

    } catch (error) {
        console.error('Error al procesar emojis:', error);
        res.status(500).json({ success: false, error: 'Error interno al cargar emojis' });
    }
});

router.post('/refresh', (req, res) => {
    emojiCache = null;
    res.json({ success: true, message: 'Caché de emojis limpiada' });
});

module.exports = router;
