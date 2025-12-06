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

        await addColumnSafe('users', 'is_admin INTEGER DEFAULT 0');
        await addColumnSafe('users', 'is_verified INTEGER DEFAULT 0');
        await addColumnSafe('users', 'is_premium INTEGER DEFAULT 0');
        await addColumnSafe('users', 'display_name TEXT');
        await addColumnSafe('users', 'bio TEXT');

        await addColumnSafe('messages', 'is_pinned INTEGER DEFAULT 0');
        await addColumnSafe('messages', 'is_edited INTEGER DEFAULT 0');

        await addColumnSafe('messages', 'channel_id INTEGER');
        await addColumnSafe('channels', 'is_public INTEGER DEFAULT 0');
        await addColumnSafe('channels', 'handle TEXT');
        await addColumnSafe('channels', 'invite_link TEXT');

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

module.exports = { initDatabase, fixChannelTables };
