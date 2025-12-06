require('dotenv').config();
const { createClient } = require("@libsql/client");

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// Adaptador para simular sqlite3
const db = {
    run: function (sql, params, callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        params = params || [];
        client.execute({ sql, args: params })
            .then((result) => {
                const context = { lastID: Number(result.lastInsertRowid), changes: result.rowsAffected };
                if (callback) callback.call(context, null);
            })
            .catch((err) => { if (callback) callback(err); else console.error("Error DB (run):", err.message); });
    },
    get: function (sql, params, callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        params = params || [];
        client.execute({ sql, args: params })
            .then((result) => { if (callback) callback(null, result.rows[0]); })
            .catch((err) => { if (callback) callback(err); else console.error("Error DB (get):", err.message); });
    },
    all: function (sql, params, callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        params = params || [];
        client.execute({ sql, args: params })
            .then((result) => { if (callback) callback(null, result.rows); })
            .catch((err) => { if (callback) callback(err); else console.error("Error DB (all):", err.message); });
    },
    serialize: function (callback) { if (callback) callback(); },
    prepare: function (sql) { return { run: (...args) => db.run(sql, args), finalize: () => { } } }
};

console.log('Conectado a Turso (LibSQL).');

module.exports = { db, client };
