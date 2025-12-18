const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const { encrypt, decrypt } = require('../utils/encryption');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
let io;

const initSocket = (server) => {
    io = new Server(server);

    io.use((socket, next) => {
        let token = null;

        // Primero intentar leer el token de socket.handshake.auth (Capacitor/mobile)
        if (socket.handshake.auth && socket.handshake.auth.token) {
            token = socket.handshake.auth.token;
        }
        // Si no, intentar leer de las cookies (web browser)
        else {
            const cookieHeader = socket.request.headers.cookie;
            if (cookieHeader) {
                const cookies = {};
                cookieHeader.split(';').forEach(cookie => {
                    const parts = cookie.split('=');
                    cookies[parts.shift().trim()] = decodeURI(parts.join('='));
                });
                token = cookies['chat_token'];
            }
        }

        if (!token) return next(new Error("No autorizado"));

        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) return next(new Error("Token inválido"));
            socket.data.userId = decoded.id;
            socket.data.username = decoded.username;
            socket.data.isAdmin = decoded.is_admin;
            next();
        });
    });

    io.on('connection', (socket) => {
        const userId = socket.data.userId;
        socket.join(`user_${userId}`);
        let msgCount = 0; setInterval(() => { msgCount = 0; }, 1000);

        db.get(`SELECT avatar FROM users WHERE id = ?`, [userId], (err, row) => { if (row) socket.data.avatar = row.avatar; emitUsers(); });
        db.all(`SELECT target_user_id, nickname FROM nicknames WHERE user_id = ?`, [userId], (err, rows) => {
            if (!err && rows) { const map = {}; rows.forEach(r => map[r.target_user_id] = r.nickname); socket.emit('nicknames', map); }
        });

        socket.on('set nickname', ({ targetUserId, nickname }) => {
            if (!targetUserId || (nickname && nickname.length > 50)) return;
            if (!nickname || !nickname.trim()) db.run(`DELETE FROM nicknames WHERE user_id = ? AND target_user_id = ?`, [userId, targetUserId]);
            else db.run(`INSERT OR REPLACE INTO nicknames (user_id, target_user_id, nickname) VALUES (?, ?, ?)`, [userId, targetUserId, nickname.trim()]);
        });

        socket.on('private message', ({ content, toUserId, toChannelId, type = 'text', replyToId = null, caption = null }, callback) => {
            if (msgCount > 5) return;
            msgCount++;

            if ((!toUserId && !toChannelId) || !content) return;
            if (!['text', 'image', 'audio', 'sticker'].includes(type)) type = 'text';

            const encryptedContent = encrypt(content);
            const encryptedCaption = caption ? encrypt(caption) : null;

            if (toChannelId) {
                db.get(`SELECT owner_id FROM channels WHERE id = ?`, [toChannelId], (err, channelRow) => {
                    if (err || !channelRow) return;
                    if (channelRow.owner_id !== userId) {
                        console.log(`Usuario ${userId} intentó escribir en canal ${toChannelId} sin permiso.`);
                        return;
                    }

                    db.run(`INSERT INTO messages (from_user_id, channel_id, content, type, reply_to_id, caption) VALUES (?, ?, ?, ?, ?, ?)`,
                        [userId, toChannelId, encryptedContent, type, replyToId, encryptedCaption],
                        function (err) {
                            if (err) return console.error("Error insertando mensaje canal:", err.message);

                            const newMessageId = this.lastID;
                            const payload = {
                                id: newMessageId,
                                content: content,
                                type: type,
                                fromUserId: userId,
                                channelId: toChannelId,
                                timestamp: new Date().toISOString(),
                                caption: caption,
                                replyToId: replyToId
                            };

                            io.emit('channel_message', payload);
                            if (callback) callback(payload);
                        });
                });
            } else {
                db.run(`INSERT INTO messages (from_user_id, to_user_id, content, type, reply_to_id, caption) VALUES (?, ?, ?, ?, ?, ?)`,
                    [userId, toUserId, encryptedContent, type, replyToId, encryptedCaption],
                    function (err) {
                        if (err) return;
                        const newMessageId = this.lastID;

                        const emitMsg = (replyData) => {
                            const payload = {
                                id: newMessageId,
                                content: content,
                                type: type,
                                fromUserId: userId,
                                timestamp: new Date().toISOString(),
                                caption: caption,
                                replyToId: replyToId,
                                reply_content: replyData ? replyData.content : null,
                                reply_type: replyData ? replyData.type : null,
                                reply_from_id: replyData ? replyData.from_user_id : null
                            };

                            socket.to(`user_${toUserId}`).emit('private message', payload);
                            if (callback) callback(payload);
                        };

                        if (replyToId) {
                            db.get(`SELECT content, type, from_user_id FROM messages WHERE id = ?`, [replyToId], (err, row) => {
                                if (row) emitMsg({ ...row, content: decrypt(row.content) });
                                else emitMsg(null);
                            });
                        } else {
                            emitMsg(null);
                        }
                    }
                );
            }
        });

        socket.on('delete message', ({ messageId, toUserId, deleteType }) => {
            const userId = socket.data.userId;
            const isAdmin = socket.data.isAdmin;

            if (deleteType === 'everyone') {
                let query = `UPDATE messages SET is_deleted = 1 WHERE id = ?`;
                let params = [messageId];
                if (!isAdmin) { query += ` AND from_user_id = ?`; params.push(userId); }

                db.run(query, params, function (err) {
                    if (!err && this.changes > 0) {
                        socket.to(`user_${toUserId}`).emit('message deleted', { messageId });
                        socket.emit('message deleted', { messageId });
                    }
                });
            } else if (deleteType === 'me') {
                db.run(`INSERT OR IGNORE INTO hidden_messages (user_id, message_id) VALUES (?, ?)`, [userId, messageId], (err) => { });
            }
        });

        socket.on('clear chat history', ({ toUserId, deleteType }) => {
            const userId = socket.data.userId;
            const targetId = parseInt(toUserId);
            if (!targetId) return;

            if (deleteType === 'everyone') {
                const sqlUpdate = `UPDATE messages SET is_deleted = 1 WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`;
                db.run(sqlUpdate, [userId, targetId, targetId, userId], function (err) {
                    if (!err) {
                        socket.emit('chat history cleared', { chatId: targetId });
                        socket.to(`user_${targetId}`).emit('chat history cleared', { chatId: userId });
                    }
                });
            } else {
                const sqlGet = `SELECT id FROM messages WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`;
                db.all(sqlGet, [userId, targetId, targetId, userId], (err, rows) => {
                    if (rows && rows.length > 0) {
                        rows.forEach(row => db.run(`INSERT OR IGNORE INTO hidden_messages (user_id, message_id) VALUES (?, ?)`, [userId, row.id]));
                        socket.emit('chat history cleared', { chatId: targetId });
                    }
                });
            }
        });

        socket.on('pin message', ({ messageId, toUserId, type }) => {
            const myId = socket.data.userId;
            const resetSql = `UPDATE messages SET is_pinned = 0 WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`;

            db.run(resetSql, [myId, toUserId, toUserId, myId], (err) => {
                if (err) return;

                if (messageId) {
                    db.run(`UPDATE messages SET is_pinned = 1 WHERE id = ?`, [messageId], (err2) => {
                        if (!err2) {
                            db.get(`SELECT content, type, caption FROM messages WHERE id = ?`, [messageId], (err3, row) => {
                                if (row) {
                                    const cleanContent = decrypt(row.content);
                                    const payload = {
                                        messageId,
                                        content: row.type === 'text' ? cleanContent : (row.caption ? decrypt(row.caption) : 'Archivo adjunto'),
                                        type: row.type
                                    };
                                    socket.emit('chat pinned update', payload);
                                    socket.to(`user_${toUserId}`).emit('chat pinned update', payload);
                                }
                            });
                        }
                    });
                } else {
                    const payload = { messageId: null };
                    socket.emit('chat pinned update', payload);
                    socket.to(`user_${toUserId}`).emit('chat pinned update', payload);
                }
            });
        });

        socket.on('edit message', ({ messageId, newContent, toUserId }) => {
            const myId = socket.data.userId;
            db.get(`SELECT from_user_id, timestamp FROM messages WHERE id = ?`, [messageId], (err, row) => {
                if (err || !row) return;
                if (row.from_user_id !== myId) return;

                const msgTime = new Date(row.timestamp).getTime();
                const now = Date.now();
                const hoursDiff = (now - msgTime) / (1000 * 60 * 60);

                if (hoursDiff > 24) return;

                const encryptedContent = encrypt(newContent);
                db.run(`UPDATE messages SET content = ?, is_edited = 1 WHERE id = ?`, [encryptedContent, messageId], (err) => {
                    if (!err) {
                        const payload = {
                            messageId,
                            newContent: newContent,
                            isEdited: 1
                        };
                        socket.emit('message updated', payload);
                        socket.to(`user_${toUserId}`).emit('message updated', payload);
                    }
                });
            });
        });

        socket.on('typing', ({ toUserId }) => socket.to(`user_${toUserId}`).emit('typing', { fromUserId: userId, username: socket.data.username }));
        socket.on('stop typing', ({ toUserId }) => socket.to(`user_${toUserId}`).emit('stop typing', { fromUserId: userId }));
        socket.on('disconnect', () => { emitUsers(); });
    });

    return io;
};

const getIo = () => {
    if (!io) throw new Error("Socket.io not initialized!");
    return io;
};

function emitUsers() {
    if (!io) return;

    const onlineUserIds = new Set();
    if (io.of("/")) {
        for (let [id, socket] of io.of("/").sockets) {
            if (socket.data.userId) onlineUserIds.add(socket.data.userId);
        }
    }

    if (io.of("/")) {
        for (let [id, socket] of io.of("/").sockets) {
            const userId = socket.data.userId;
            if (!userId) continue;

            db.all(
                `SELECT u.id, u.username, u.display_name, u.bio, u.avatar, u.is_verified, u.is_admin, u.is_premium
                 FROM contacts c
                 JOIN users u ON c.contact_user_id = u.id
                 WHERE c.user_id = ?`,
                [userId],
                (err, rows) => {
                    if (err) {
                        console.error('Error getting contacts for user:', userId, err);
                        return;
                    }

                    const contacts = rows.map(row => ({
                        userId: row.id,
                        username: row.username,
                        display_name: row.display_name,
                        bio: row.bio,
                        avatar: row.avatar || '/profile.png',
                        online: onlineUserIds.has(row.id),
                        is_verified: row.is_verified,
                        is_admin: row.is_admin,
                        is_premium: row.is_premium
                    }));

                    socket.emit('users', contacts);
                }
            );
        }
    }
}

module.exports = { initSocket, getIo, emitUsers };
