const { client } = require('../config/db');

async function initDatabase() {
    try {
        const addColumnSafe = async (table, columnDef) => {
            try {
                await client.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
            } catch (error) {
            }
        };

        await client.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, avatar TEXT)`);
        await client.execute(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, from_user_id INTEGER, to_user_id INTEGER, content TEXT, type TEXT DEFAULT 'text', reply_to_id INTEGER, is_deleted INTEGER DEFAULT 0, caption TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        await client.execute(`CREATE TABLE IF NOT EXISTS nicknames (user_id INTEGER, target_user_id INTEGER, nickname TEXT, PRIMARY KEY (user_id, target_user_id))`);
        await client.execute(`CREATE TABLE IF NOT EXISTS favorite_stickers (user_id INTEGER, sticker_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, sticker_url))`);
        await client.execute(`CREATE TABLE IF NOT EXISTS love_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        await client.execute(`CREATE TABLE IF NOT EXISTS hidden_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, message_id INTEGER, UNIQUE(user_id, message_id))`);

        await client.execute(`CREATE TABLE IF NOT EXISTS channels (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, avatar TEXT, owner_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        await client.execute(`CREATE TABLE IF NOT EXISTS channel_members (channel_id INTEGER, user_id INTEGER, role TEXT DEFAULT 'member', PRIMARY KEY(channel_id, user_id))`);

        await client.execute(`CREATE TABLE IF NOT EXISTS channel_bans (channel_id INTEGER, user_id INTEGER, banned_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(channel_id, user_id))`);

        await client.execute(`CREATE TABLE IF NOT EXISTS contacts (user_id INTEGER, contact_user_id INTEGER, added_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, contact_user_id))`);

        // Stories Feature
        await client.execute(`CREATE TABLE IF NOT EXISTS stories (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, media_url TEXT, caption TEXT, type TEXT DEFAULT 'image', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME)`);
        await client.execute(`CREATE TABLE IF NOT EXISTS story_views (story_id INTEGER, viewer_id INTEGER, viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(story_id, viewer_id))`);

        await addColumnSafe('stories', 'is_hidden INTEGER DEFAULT 0');

        await addColumnSafe('users', 'created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
        await addColumnSafe('users', 'is_admin INTEGER DEFAULT 0');
        await addColumnSafe('users', 'is_verified INTEGER DEFAULT 0');
        await addColumnSafe('users', 'is_premium INTEGER DEFAULT 0');
        await addColumnSafe('users', 'display_name TEXT');
        await addColumnSafe('users', 'bio TEXT');

        await client.execute(`CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER, target_id INTEGER, type TEXT, reason TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

        await addColumnSafe('messages', 'is_pinned INTEGER DEFAULT 0');
        await addColumnSafe('messages', 'is_edited INTEGER DEFAULT 0');

        await addColumnSafe('messages', 'channel_id INTEGER');
        await addColumnSafe('channels', 'is_public INTEGER DEFAULT 0');
        await addColumnSafe('channels', 'handle TEXT');
        await addColumnSafe('channels', 'invite_link TEXT');

        // Indexes for Search Optimization
        try {
            await client.execute(`DROP INDEX IF EXISTS idx_users_username`);
            await client.execute(`DROP INDEX IF EXISTS idx_channels_name`);
            await client.execute(`DROP INDEX IF EXISTS idx_channels_handle`);
        } catch (e) { }

        await client.execute(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)`);
        await client.execute(`CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name COLLATE NOCASE)`);
        await client.execute(`CREATE INDEX IF NOT EXISTS idx_channels_handle ON channels(handle COLLATE NOCASE)`);

        // Critical for contact list performance
        await client.execute(`CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(from_user_id, to_user_id)`);
        await client.execute(`CREATE INDEX IF NOT EXISTS idx_messages_users_reverse ON messages(to_user_id, from_user_id)`);

        console.log("✅ Base de datos verificada y actualizada.");
    } catch (error) {
        console.error("❌ Error DB Init:", error);
    }
}

async function fixChannelTables() {
    console.log("🔧 Intentando reparar tablas de canales...");

    try {
        await client.execute("ALTER TABLE channel_members ADD COLUMN role TEXT DEFAULT 'member'");
        console.log("✅ Columna 'role' agregada.");
    } catch (e) { }

    try {
        await client.execute("ALTER TABLE channel_members ADD COLUMN joined_at TEXT");
        console.log("✅ Columna 'joined_at' agregada.");
        await client.execute("UPDATE channel_members SET joined_at = CURRENT_TIMESTAMP WHERE joined_at IS NULL");
        console.log("✅ Fechas de unión actualizadas.");
    } catch (e) {
        if (!e.message.includes("duplicate column")) console.log("Nota sobre joined_at:", e.message);
    }

    try {
        await client.execute(`CREATE TABLE IF NOT EXISTS channel_bans (channel_id INTEGER, user_id INTEGER, banned_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(channel_id, user_id))`);
        console.log("✅ Tabla 'channel_bans' verificada.");
    } catch (e) {
        console.log("Error channel_bans:", e.message);
    }

    try {
        await client.execute("ALTER TABLE channels ADD COLUMN private_hash TEXT");
        console.log("✅ Columna 'private_hash' agregada.");

        const crypto = require('crypto');
        const rows = await client.execute("SELECT id FROM channels WHERE private_hash IS NULL");
        for (const row of rows.rows) {
            const hash = crypto.randomBytes(8).toString('hex');
            await client.execute({
                sql: "UPDATE channels SET private_hash = ? WHERE id = ?",
                args: [hash, row.id]
            });
        }
    } catch (e) { }
}

async function migrateExistingMessagesToContacts() {
    console.log("🔄 Migrando usuarios con mensajes a contactos...");

    try {
        const result = await client.execute(`
            SELECT DISTINCT 
                from_user_id as user1, 
                to_user_id as user2 
            FROM messages 
            WHERE to_user_id IS NOT NULL
        `);

        const pairs = new Set();

        for (const row of result.rows) {
            const user1 = row.user1;
            const user2 = row.user2;

            if (user1 && user2) {
                pairs.add(`${user1}-${user2}`);
                pairs.add(`${user2}-${user1}`);
            }
        }

        let count = 0;
        for (const pair of pairs) {
            const [userId, contactId] = pair.split('-').map(Number);
            try {
                await client.execute({
                    sql: "INSERT OR IGNORE INTO contacts (user_id, contact_user_id) VALUES (?, ?)",
                    args: [userId, contactId]
                });
                count++;
            } catch (e) {
            }
        }

        console.log(`✅ Migración completada: ${count} relaciones de contacto creadas.`);
    } catch (e) {
        console.error("❌ Error en migración de contactos:", e.message);
    }
}

module.exports = { initDatabase, fixChannelTables, migrateExistingMessagesToContacts };
