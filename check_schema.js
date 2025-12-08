const { client } = require('./config/db');

(async () => {
    try {
        const res = await client.execute("PRAGMA table_info(users)");
        console.log("Table Info:", res.rows);
    } catch (e) {
        console.error(e);
    }
})();
