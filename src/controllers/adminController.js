const { db } = require('../config/db');

exports.getStats = (req, res) => {
    const range = req.query.range === '30' ? 30 : 7;
    const d = new Date();
    d.setDate(d.getDate() - range);
    const dateThreshold = d.toISOString();

    const sqlGraph = `
        SELECT date(created_at) as date, COUNT(*) as count 
        FROM users 
        WHERE created_at >= ? 
        GROUP BY date(created_at) 
        ORDER BY date(created_at) ASC
    `;

    // 2. Channel Metrics
    const sqlChannels = `SELECT COUNT(*) as total FROM channels`;
    const sqlChannelMembers = `SELECT COUNT(*) as total FROM channel_members`;

    db.serialize(() => {
        const stats = {};

        db.all(sqlGraph, [dateThreshold], (err, rows) => {
            if (err) {
                console.error("Graph Error:", err);
                return res.status(500).json({ error: "DB Error Graph" });
            }
            stats.graph = rows || [];

            db.get(sqlChannels, (err2, r2) => {
                if (err2) return res.status(500).json({ error: "DB Error Channels" });
                stats.totalChannels = r2 ? r2.total : 0;

                db.get(sqlChannelMembers, (err3, r3) => {
                    if (err3) return res.status(500).json({ error: "DB Error Members" });
                    stats.totalChannelMembers = r3 ? r3.total : 0;

                    res.json(stats);
                });
            });
        });
    });
};

exports.getReports = (res) => {
    const sql = `
        SELECT r.*, u.username as reporter_username, u.avatar as reporter_avatar 
        FROM reports r
        LEFT JOIN users u ON r.reporter_id = u.id
        ORDER BY r.created_at DESC
        LIMIT 50
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: "DB Error Reports" });
        res.json(rows);
    });
};

exports.getAllUsers = (res) => {
    const sql = `SELECT id, username, display_name, avatar, is_admin, is_verified, is_premium, bio, created_at FROM users ORDER BY id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("DEBUG: getAllUsers error:", err);
            return res.status(500).json({ error: "DB Error Users" });
        }
        res.json(rows);
    });
};
