const { db } = require('../config/db');
const { encrypt, decrypt } = require('../utils/encryption');
const { getIo } = require('../sockets/socketManager');
require('dotenv').config();

exports.getMessages = (req, res) => {
    const { myId, otherId } = req.params;
    if (parseInt(myId) !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'No autorizado' });

    db.get(`SELECT is_admin FROM users WHERE id = ?`, [myId], (err, userRow) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        const isAdmin = userRow && userRow.is_admin === 1;

        let sqlCondition = `((m.from_user_id = ? AND m.to_user_id = ?) OR (m.from_user_id = ? AND m.to_user_id = ?))`;
        if (!isAdmin) sqlCondition += ` AND m.is_deleted = 0`;

        const sql = `
            SELECT m.*, r.content as reply_content, r.type as reply_type, r.from_user_id as reply_from_id 
            FROM messages m 
            LEFT JOIN messages r ON m.reply_to_id = r.id 
            LEFT JOIN hidden_messages h ON h.message_id = m.id AND h.user_id = ? 
            WHERE ${sqlCondition} AND h.id IS NULL 
            ORDER BY m.timestamp ASC
        `;

        db.all(sql, [myId, myId, otherId, otherId, myId], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Error DB' });
            const decryptedRows = rows.map(row => ({
                ...row,
                content: decrypt(row.content),
                reply_content: row.reply_content ? decrypt(row.reply_content) : null,
                caption: row.caption ? decrypt(row.caption) : null,
            }));
            res.json(decryptedRows);
        });
    });
};

exports.uploadChatImage = (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió imagen' });
    res.json({ imageUrl: req.file.path });
};

exports.uploadAudio = (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió audio' });
    res.json({ audioUrl: req.file.path });
};

exports.sendLoveNote = (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'No autorizado' });
    const { targetUserId, content } = req.body;

    if (!content || !content.trim()) return res.status(400).json({ error: 'Mensaje vacío' });

    const encryptedNote = encrypt(content);

    db.run(`INSERT INTO love_notes (user_id, content) VALUES (?, ?)`, [targetUserId, encryptedNote], function (err) {
        if (err) return res.status(500).json({ error: 'Error DB' });

        try { getIo().to(`user_${targetUserId}`).emit('new_love_note'); } catch (e) { }
        res.json({ success: true });
    });
};

exports.getMyLoveNotes = (req, res) => {
    db.run(`DELETE FROM love_notes WHERE timestamp <= datetime('now', '-1 day')`, [], (err) => {
        if (err) console.error("Error limpiando notas antiguas:", err);

        db.all(`SELECT id, content, timestamp FROM love_notes WHERE user_id = ? ORDER BY id DESC`, [req.user.id], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Error DB' });

            const notes = rows.map(r => ({
                id: r.id,
                content: decrypt(r.content),
                timestamp: r.timestamp
            }));
            res.json(notes);
        });
    });
};

exports.getStickers = async (req, res) => {
    try {
        const { q } = req.query;
        if (!process.env.GIPHY_API_KEY) return res.status(500).json({ error: 'Falta API Key' });
        const url = `https://api.giphy.com/v1/stickers/${q ? 'search' : 'trending'}?api_key=${process.env.GIPHY_API_KEY}&limit=24&rating=g&q=${encodeURIComponent(q || '')}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Giphy API error`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error Stickers:", error.message);
        res.status(500).json({ error: 'Error interno' });
    }
};

exports.addFavoriteSticker = (req, res) => {
    db.run(`INSERT OR IGNORE INTO favorite_stickers (user_id, sticker_url) VALUES (?, ?)`, [req.user.id, req.body.url], (err) => res.json({ success: !err }));
};

exports.removeFavoriteSticker = (req, res) => {
    db.run(`DELETE FROM favorite_stickers WHERE user_id = ? AND sticker_url = ?`, [req.user.id, req.body.url], (err) => res.json({ success: !err }));
};

exports.getFavoriteStickers = (req, res) => {
    if (parseInt(req.params.userId) !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
    db.all(`SELECT sticker_url FROM favorite_stickers WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id], (err, rows) => res.json(rows ? rows.map(r => r.sticker_url) : []));
};

exports.getPinnedMessage = (req, res) => {
    const myId = req.user.id;
    const otherId = req.params.otherId;

    const sql = `
        SELECT id, content, type, caption 
        FROM messages 
        WHERE ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
        AND is_pinned = 1 
        LIMIT 1
    `;

    db.get(sql, [myId, otherId, otherId, myId], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB Error' });

        if (row) {
            const cleanContent = decrypt(row.content);
            const cleanCaption = row.caption ? decrypt(row.caption) : null;

            res.json({
                found: true,
                messageId: row.id,
                content: row.type === 'text' ? cleanContent : (cleanCaption || 'Archivo adjunto'),
                type: row.type
            });
        } else {
            res.json({ found: false });
        }
    });
};
