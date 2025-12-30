const { db } = require('../config/db');

async function migrateWebP() {
    console.log('Starting WebP migration...');

    // 1. Migrate Users (Avatars)
    db.all(`SELECT id, avatar FROM users WHERE avatar LIKE '%cloudinary%' AND avatar NOT LIKE '%f_webp%'`, [], (err, rows) => {
        if (err) return console.error('Error fetching users:', err);
        console.log(`Found ${rows.length} users to migrate.`);

        rows.forEach(user => {
            if (user.avatar.includes('/upload/')) {
                const newAvatar = user.avatar.replace('/upload/', '/upload/f_webp/');
                db.run(`UPDATE users SET avatar = ? WHERE id = ?`, [newAvatar, user.id], (e) => {
                    if (e) console.error(`Failed to update user ${user.id}`, e);
                });
            }
        });
    });

    // 2. Migrate Messages (Images)
    // Note: Content is encrypted, so we can't easily SQL replace. 
    // We would need to decrypt, replace, and encrypt.
    // However, if the client handles the URL display, we can just let old messages be.
    // BUT the user asked for "todas las imagenes que se suban y hay actualmente".
    // Since messages are encrypted, running a migration script that decrypts everything and re-encrypts is risky and complex for this scope.
    // ALTERNATIVE: The user might refer to non-encrypted fields or just visible things.
    // Wait, the previous messageController code shows `content` IS encrypted.
    // Migrating encrypted content is VERY dangerous without a robust backup.
    // I will skip migrating ENCRYPTED messages for safety unless explicitly forced, but I'll migrate STORIES which are plain text (media_url).

    // Correction: stories.media_url is NOT encrypted in the INSERT statement in storyController.js.
    // "INSERT INTO stories ... VALUES (?, mediaUrl, caption ...)"
    // Caption is encrypted, media_url is NOT.

    // 3. Migrate Stories
    db.all(`SELECT id, media_url FROM stories WHERE media_url LIKE '%cloudinary%' AND media_url NOT LIKE '%f_webp%'`, [], (err, rows) => {
        if (err) return console.error('Error fetching stories:', err);
        console.log(`Found ${rows.length} stories to migrate.`);

        rows.forEach(story => {
            if (story.media_url.includes('/upload/')) {
                const newUrl = story.media_url.replace('/upload/', '/upload/f_webp/');
                db.run(`UPDATE stories SET media_url = ? WHERE id = ?`, [newUrl, story.id], (e) => {
                    if (e) console.error(`Failed to update story ${story.id}`, e);
                });
            }
        });
    });

    console.log('Migration commands issued. Check logs for errors.');
}

migrateWebP();
