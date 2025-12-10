const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Cache simple para no leer el disco en cada request (opcional, pero bueno para performance)
let emojiCache = null;

router.get('/', (req, res) => {
    try {
        if (emojiCache) {
            return res.json({ success: true, data: emojiCache });
        }

        const emojisDir = path.join(__dirname, '../public/Animated-Emojis');

        // Verificar si existe el directorio
        if (!fs.existsSync(emojisDir)) {
            console.error('Directorio de emojis no encontrado:', emojisDir);
            return res.json({ success: true, data: {} });
        }

        const categories = {};
        const items = fs.readdirSync(emojisDir, { withFileTypes: true });

        for (const item of items) {
            if (item.isDirectory()) {
                const categoryName = item.name;
                const categoryPath = path.join(emojisDir, categoryName);

                // Leer archivos dentro de la categoría
                const files = fs.readdirSync(categoryPath)
                    .filter(file => /\.(png|webp|gif)$/i.test(file)) // Filtrar solo imágenes
                    .map(file => `/Animated-Emojis/${categoryName}/${file}`);

                if (files.length > 0) {
                    categories[categoryName] = files;
                }
            }
        }

        emojiCache = categories; // Guardar en caché
        res.json({ success: true, data: categories });

    } catch (error) {
        console.error('Error al leer emojis:', error);
        res.status(500).json({ success: false, error: 'Error interno al cargar emojis' });
    }
});

// Endpoint para limpiar caché si se agregan nuevos emojis sin reiniciar
router.post('/refresh', (req, res) => {
    emojiCache = null;
    res.json({ success: true, message: 'Caché de emojis limpiada' });
});

module.exports = router;
