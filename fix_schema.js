const { client } = require('./config/db');

(async () => {
    console.log("Attempting to add created_at column...");
    try {
        await client.execute("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
        console.log("✅ Success!");
    } catch (e) {
        console.error("❌ Failed:", e.message);

        // Try fallback without default
        try {
            console.log("Attempting fallback...");
            await client.execute("ALTER TABLE users ADD COLUMN created_at DATETIME");
            console.log("✅ Success (No default)!");
            // Backfill
            await client.execute("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL");
            console.log("✅ Backfilled timestamps.");
        } catch (e2) {
            console.error("❌ Fallback Failed:", e2.message);
        }
    }
})();
