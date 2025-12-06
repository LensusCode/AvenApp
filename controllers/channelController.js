const { db } = require('../config/db');
const { getIo } = require('../sockets/socketManager');
const { decrypt } = require('../utils/encryption');
const crypto = require('crypto');

exports.addMembers = (req, res) => {
    const channelId = req.params.id;
    const { userIds } = req.body;
    const ownerId = req.user.id;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "No se seleccionaron usuarios" });
    }

    db.get(`SELECT owner_id FROM channels WHERE id = ?`, [channelId], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Canal no encontrado" });
        if (row.owner_id !== ownerId) return res.status(403).json({ error: "No autorizado" });

        const now = new Date().toISOString();
        let addedCount = 0;

        const stmt = db.prepare(`INSERT OR IGNORE INTO channel_members (channel_id, user_id, joined_at) VALUES (?, ?, ?)`);

        userIds.forEach(uid => {
            stmt.run(channelId, uid, now);
            addedCount++;
        });

        stmt.finalize();

        try { getIo().emit('channels_update'); } catch (e) { }

        res.json({ success: true, added: addedCount });
    });
};

exports.leaveChannel = (req, res) => {
    const channelId = req.params.id;
    const userId = req.user.id;

    db.get(`SELECT owner_id FROM channels WHERE id = ?`, [channelId], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Canal no encontrado" });

        if (row.owner_id === userId) {
            return res.status(400).json({ error: "El dueño no puede salir del canal. Debes eliminarlo." });
        }

        db.run(`DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?`, [channelId, userId], function (err) {
            if (err) return res.status(500).json({ error: "Error al salir" });
            res.json({ success: true });
        });
    });
};

exports.createChannel = (req, res) => {
    try {
        const { name, bio, members, isPublic, handle } = req.body;
        const ownerId = req.user.id;
        let avatarUrl = req.file ? req.file.path : '/profile.png';

        const privateHash = crypto.randomBytes(8).toString('hex');
        const privateLink = `ap.me/+${privateHash}`;

        const isPublicInt = (isPublic === 'true' || isPublic === true) ? 1 : 0;
        let finalHandle = null;
        let activeInviteLink = null;

        if (isPublicInt === 1) {
            finalHandle = handle.toLowerCase();
            activeInviteLink = `ap.me/${finalHandle}`;
        } else {
            activeInviteLink = privateLink;
        }

        const sql = `INSERT INTO channels (name, description, avatar, owner_id, is_public, handle, invite_link, private_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        db.run(sql, [name, bio, avatarUrl, ownerId, isPublicInt, finalHandle, activeInviteLink, privateHash], function (err) {
            if (err) {
                if (err.message && err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: "El enlace público ya existe." });
                }
                return res.status(500).json({ error: "Error creando canal" });
            }

            const channelId = this.lastID;
            const now = new Date().toISOString();

            db.run(`INSERT INTO channel_members (channel_id, user_id, role, joined_at) VALUES (?, ?, 'admin', ?)`, [channelId, ownerId, now], () => { });

            if (members) {
                try {
                    const memberIds = JSON.parse(members);
                    if (Array.isArray(memberIds)) {
                        memberIds.forEach(uid => {
                            db.run(`INSERT OR IGNORE INTO channel_members (channel_id, user_id, joined_at) VALUES (?, ?, ?)`, [channelId, uid, now], () => { });
                        });
                    }
                } catch (e) { }
            }

            try { getIo().emit('channels_update'); } catch (e) { }

            res.json({
                success: true,
                channelId,
                name,
                avatar: avatarUrl,
                private_hash: privateHash
            });
        });

    } catch (e) {
        res.status(500).json({ error: "Error interno" });
    }
};

exports.getMyChannels = (req, res) => {
    const sql = `
        SELECT c.*, c.private_hash FROM channels c 
        JOIN channel_members cm ON c.id = cm.channel_id 
        WHERE cm.user_id = ? 
        ORDER BY c.created_at DESC`;

    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "DB Error" });
        res.json(rows);
    });
};

exports.getChannelMessages = (req, res) => {
    db.get(`SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?`, [req.params.channelId, req.user.id], (err, isMember) => {
        if (!isMember && !req.user.is_admin) return res.status(403).json({ error: "No eres miembro" });

        const sql = `
            SELECT m.*, u.username, u.display_name, u.avatar 
            FROM messages m
            LEFT JOIN users u ON m.from_user_id = u.id
            WHERE m.channel_id = ? AND m.is_deleted = 0
            ORDER BY m.timestamp ASC
        `;
        db.all(sql, [req.params.channelId], (err, rows) => {
            if (err) return res.status(500).json({ error: "DB Error" });
            const decryptedRows = rows.map(row => ({
                ...row,
                content: decrypt(row.content),
                caption: row.caption ? decrypt(row.caption) : null,
            }));
            res.json(decryptedRows);
        });
    });
};

exports.getChannelInfo = (req, res) => {
    const channelId = req.params.id;
    db.get(`SELECT COUNT(*) as count FROM channel_members WHERE channel_id = ?`, [channelId], (err, row) => {
        if (err) return res.status(500).json({ error: "DB Error" });
        res.json({ memberCount: row.count });
    });
};

exports.updateChannel = (req, res) => {
    const { channelId, name, description } = req.body;
    const userId = req.user.id;

    db.get(`SELECT owner_id, avatar FROM channels WHERE id = ?`, [channelId], (err, channel) => {
        if (err || !channel) return res.status(404).json({ error: "Canal no encontrado" });
        if (channel.owner_id !== userId) return res.status(403).json({ error: "No eres el dueño" });

        let avatarUrl = channel.avatar;
        if (req.file) avatarUrl = req.file.path;

        db.run(`UPDATE channels SET name = ?, description = ?, avatar = ? WHERE id = ?`,
            [name, description, avatarUrl, channelId],
            function (err) {
                if (err) return res.status(500).json({ error: "Error al actualizar" });

                try { getIo().emit('channels_update'); } catch (e) { }

                res.json({ success: true, name, description, avatar: avatarUrl });
            }
        );
    });
};

exports.getChannelMembers = (req, res) => {
    const sql = `
        SELECT u.id, u.username, u.display_name, u.avatar, cm.joined_at, cm.role
        FROM channel_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.channel_id = ?`;
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) {
            console.error("❌ ERROR SQL:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
};

exports.getBannedUsers = (req, res) => {
    const sql = `
        SELECT u.id, u.username, u.display_name, u.avatar, cb.banned_at
        FROM channel_bans cb
        JOIN users u ON cb.user_id = u.id
        WHERE cb.channel_id = ?`;
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "DB Error" });
        res.json(rows);
    });
};

exports.updateChannelType = (req, res) => {
    const { isPublic, handle } = req.body;
    const channelId = req.params.id;

    db.get(`SELECT owner_id, private_hash FROM channels WHERE id = ?`, [channelId], (err, row) => {
        if (!row || row.owner_id !== req.user.id) return res.status(403).json({ error: "No autorizado" });

        let currentPrivateHash = row.private_hash;
        if (!currentPrivateHash) {
            currentPrivateHash = crypto.randomBytes(8).toString('hex');
            db.run(`UPDATE channels SET private_hash = ? WHERE id = ?`, [currentPrivateHash, channelId], () => { });
        }

        if (isPublic) {
            db.get(`SELECT id FROM channels WHERE handle = ? AND id != ?`, [handle, channelId], (e, r) => {
                if (r) return res.json({ success: false, error: "Enlace ocupado" });

                db.run(`UPDATE channels SET is_public = 1, handle = ?, invite_link = ? WHERE id = ?`,
                    [handle, `ap.me/${handle}`, channelId],
                    (err) => res.json({ success: !err })
                );
            });
        } else {
            const privateLink = `ap.me/+${currentPrivateHash}`;

            db.run(`UPDATE channels SET is_public = 0, handle = NULL, invite_link = ? WHERE id = ?`,
                [privateLink, channelId],
                (err) => res.json({ success: !err, newLink: privateLink })
            );
        }
    });
};

exports.kickUser = (req, res) => {
    const { userId } = req.body;
    const channelId = req.params.id;

    db.get(`SELECT owner_id FROM channels WHERE id = ?`, [channelId], (err, row) => {
        if (row.owner_id !== req.user.id) return res.status(403).json({ error: "No autorizado" });

        db.run(`DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?`, [channelId, userId], () => {
            db.run(`INSERT OR IGNORE INTO channel_bans (channel_id, user_id) VALUES (?, ?)`, [channelId, userId], () => {
                res.json({ success: true });
            });
        });
    });
};

exports.unbanUser = (req, res) => {
    const { userId } = req.body;
    const channelId = req.params.id;

    db.get(`SELECT owner_id FROM channels WHERE id = ?`, [channelId], (err, row) => {
        if (row.owner_id !== req.user.id) return res.status(403).json({ error: "No autorizado" });

        db.run(`DELETE FROM channel_bans WHERE channel_id = ? AND user_id = ?`, [channelId, userId], () => {
            res.json({ success: true });
        });
    });
};

exports.checkHandle = (req, res) => {
    const { handle } = req.body;
    const regex = /^[a-zA-Z0-9_]{5,32}$/;
    if (!regex.test(handle)) {
        return res.json({ available: false, error: "Formato inválido (a-z, 0-9, _, min 5)" });
    }

    db.get(`SELECT id FROM channels WHERE handle = ?`, [handle.toLowerCase()], (err, row) => {
        if (err) return res.status(500).json({ error: "DB Error" });
        if (row) return res.json({ available: false, error: "Este enlace ya está ocupado" });
        res.json({ available: true });
    });
};
