const { db } = require('../config/db');
const { encrypt, decrypt } = require('../utils/encryption');
const { getIo } = require('../sockets/socketManager');
require('dotenv').config();

exports.getInitialSync = (req, res) => {
    const myId = req.user.id;
    const limit = 30;

    // 1. Get all private chats the user is part of
    // 2. Get all channels the user is part of
    // We can do this with multiple queries and Promise.all

    const getPrivateChatsSql = `
        SELECT DISTINCT
            CASE 
                WHEN from_user_id = ? THEN to_user_id
                ELSE from_user_id 
            END as target_user_id
        FROM messages 
        WHERE (from_user_id = ? OR to_user_id = ?) AND channel_id IS NULL
    `;

    const getChannelsSql = `
        SELECT channel_id FROM channel_members WHERE user_id = ?
    `;

    Promise.all([
        new Promise((resolve, reject) => {
            db.all(getPrivateChatsSql, [myId, myId, myId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(r => r.target_user_id));
            });
        }),
        new Promise((resolve, reject) => {
            db.all(getChannelsSql, [myId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(r => r.channel_id));
            });
        })
    ]).then(([targetUserIds, channelIds]) => {

        const responseData = {
            private: {},
            channels: {}
        };

        const promises = [];

        // Fetch messages for each private chat
        for (const targetId of targetUserIds) {
            promises.push(new Promise((resolve, reject) => {
                const sql = `
                    SELECT m.*, r.content as reply_content, r.type as reply_type, r.from_user_id as reply_from_id 
                    FROM messages m 
                    LEFT JOIN messages r ON m.reply_to_id = r.id 
                    LEFT JOIN hidden_messages h ON h.message_id = m.id AND h.user_id = ? 
                    WHERE ((m.from_user_id = ? AND m.to_user_id = ?) OR (m.from_user_id = ? AND m.to_user_id = ?)) AND m.is_deleted = 0 AND h.id IS NULL 
                    ORDER BY m.id DESC LIMIT ?
                `;
                db.all(sql, [myId, myId, targetId, targetId, myId, limit], (err, rows) => {
                    if (err) return resolve({ type: 'private', id: targetId, messages: [] });
                    const decryptedRows = rows.map(row => ({
                        ...row,
                        content: decrypt(row.content),
                        reply_content: row.reply_content ? decrypt(row.reply_content) : null,
                        caption: row.caption ? decrypt(row.caption) : null,
                    })).reverse();
                    resolve({ type: 'private', id: targetId, messages: decryptedRows });
                });
            }));
        }

        // Fetch messages for each channel
        for (const channelId of channelIds) {
            promises.push(new Promise((resolve, reject) => {
                const sql = `
                    SELECT m.*, u.username, u.display_name, u.avatar 
                    FROM messages m
                    LEFT JOIN users u ON m.from_user_id = u.id
                    WHERE m.channel_id = ? AND m.is_deleted = 0
                    ORDER BY m.id DESC LIMIT ?
                `;
                db.all(sql, [channelId, limit], (err, rows) => {
                    if (err) return resolve({ type: 'channel', id: channelId, messages: [] });
                    const decryptedRows = rows.map(row => ({
                        ...row,
                        content: decrypt(row.content),
                        caption: row.caption ? decrypt(row.caption) : null,
                    })).reverse();
                    resolve({ type: 'channel', id: channelId, messages: decryptedRows });
                });
            }));
        }

        Promise.all(promises).then(results => {
            for (const result of results) {
                if (result.type === 'private') {
                    responseData.private[result.id] = result.messages;
                } else if (result.type === 'channel') {
                    responseData.channels[result.id] = result.messages;
                }
            }
            res.json(responseData);
        }).catch(err => {
            console.error("Error fetching initial sync messages:", err);
            res.status(500).json({ error: 'Error DB' });
        });

    }).catch(err => {
        console.error("Error fetching initial sync lists:", err);
        res.status(500).json({ error: 'Error DB' });
    });
};

exports.getMessages = (req, res) => {
    const { myId, otherId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const beforeId = req.query.beforeId ? parseInt(req.query.beforeId) : null;

    console.log(`[getMessages] myId=${myId}, otherId=${otherId}, limit=${limit}, beforeId=${beforeId}`);

    if (parseInt(myId) !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'No autorizado' });

    db.get(`SELECT is_admin FROM users WHERE id = ?`, [myId], (err, userRow) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        const isAdmin = userRow && userRow.is_admin === 1;

        // Base 4 params for the conversation condition
        let wherParams = [myId, otherId, otherId, myId];
        let sqlCondition = `((m.from_user_id = ? AND m.to_user_id = ?) OR (m.from_user_id = ? AND m.to_user_id = ?))`;

        if (!isAdmin) sqlCondition += ` AND m.is_deleted = 0`;

        if (beforeId) {
            sqlCondition += ` AND m.id < ?`;
            wherParams.push(beforeId);
        }

        // Correct Parameter Order:
        // 1. myId (for hidden_messages JOIN)
        // 2. ...wherParams (for WHERE clause)
        // 3. limit (for LIMIT)
        const finalParams = [myId, ...wherParams, limit];

        console.log(`[getMessages] finalParams:`, finalParams);

        const sql = `
            SELECT m.*, r.content as reply_content, r.type as reply_type, r.from_user_id as reply_from_id 
            FROM messages m 
            LEFT JOIN messages r ON m.reply_to_id = r.id 
            LEFT JOIN hidden_messages h ON h.message_id = m.id AND h.user_id = ? 
            WHERE ${sqlCondition} AND h.id IS NULL 
            ORDER BY m.id DESC LIMIT ?
        `;

        db.all(sql, finalParams, (err, rows) => {
            if (err) return res.status(500).json({ error: 'Error DB' });

            // Decrypt and Reverse to return chronological order (Oldest -> Newest)
            const decryptedRows = rows.map(row => ({
                ...row,
                content: decrypt(row.content),
                reply_content: row.reply_content ? decrypt(row.reply_content) : null,
                caption: row.caption ? decrypt(row.caption) : null,
            })).reverse();

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
