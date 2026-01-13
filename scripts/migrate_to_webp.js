require('dotenv').config();
const { client } = require('../src/config/db');

async function migrateImages() {
    console.log("🚀 Iniciando migración de imágenes a WebP...");

    const transformUrl = (url) => {
        if (!url || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
            return null;
        }
        if (url.includes('f_webp') && url.includes('q_auto')) {
            return null; // Ya está optimizada
        }

        // 1. Insertar transformaciones si no existen
        let newUrl = url.replace('/image/upload/', '/image/upload/f_webp,q_auto/');

        // 2. Cambiar extensión a .webp
        // Reemplaza la extensión final (.jpg, .png, etc.) por .webp
        newUrl = newUrl.replace(/\.[^/.]+$/, ".webp");

        return newUrl;
    };

    const updateTable = async (table, idColumn, urlColumn, whereClause = "") => {
        console.log(`\n📦 Procesando tabla '${table}'...`);
        try {
            const query = `SELECT ${idColumn}, ${urlColumn} FROM ${table} WHERE ${urlColumn} IS NOT NULL ${whereClause}`;
            const result = await client.execute(query);

            let updatedCount = 0;
            for (const row of result.rows) {
                const originalUrl = row[urlColumn];
                const newUrl = transformUrl(originalUrl);

                if (newUrl && newUrl !== originalUrl) {
                    await client.execute({
                        sql: `UPDATE ${table} SET ${urlColumn} = ? WHERE ${idColumn} = ?`,
                        args: [newUrl, row[idColumn]]
                    });
                    updatedCount++;
                    // console.log(`  ✅ Modificado ID ${row[idColumn]}: ...${originalUrl.slice(-15)} -> ...${newUrl.slice(-15)}`);
                }
            }
            console.log(`✅ Tabla '${table}': ${updatedCount} registros actualizados.`);
        } catch (error) {
            console.error(`❌ Error en tabla '${table}':`, error.message);
        }
    };

    await updateTable('users', 'id', 'avatar');
    await updateTable('channels', 'id', 'avatar');
    await updateTable('stories', 'id', 'media_url', "AND type = 'image'");
    await updateTable('messages', 'id', 'content', "AND type = 'image'");

    console.log("\n✨ Migración completada.");
}

migrateImages();
