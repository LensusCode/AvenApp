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

exports.searchChannels = (req, res) => {
    const query = req.query.q || '';
    const userId = req.user.id;

    if (!query || query.length < 2) return res.json([]);

    const term = `%${query.toLowerCase()}%`;

    // REGLA DE PRIVACIDAD:
    // 1. Canales Públicos (is_public = 1) -> Mostrar siempre si coinciden
    // 2. Canales Privados (is_public = 0) -> Mostrar SOLO si el usuario es MIEMBRO o DUEÑO
    const sql = `
        SELECT c.id, c.name, c.avatar, c.is_public, c.handle, c.private_hash
        FROM channels c
        LEFT JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = ?
        WHERE (LOWER(c.name) LIKE ? OR LOWER(c.handle) LIKE ?)
        AND (
            c.is_public = 1 
            OR 
            (c.is_public = 0 AND (c.owner_id = ? OR cm.user_id IS NOT NULL))
        )
        LIMIT 20
    `;

    db.all(sql, [userId, term, term, userId], (err, rows) => {
        if (err) return res.status(500).json({ error: "DB Error" });
        res.json(rows);
    });
};

exports.getChannelPreview = (req, res) => {
    const { identifier } = req.params; // handle or private_hash
    const userId = req.user ? req.user.id : null; // User might be checking preview before joining

    // Primero intentamos buscar por handle (público) - Tal cual
    db.get(`SELECT * FROM channels WHERE handle = ?`, [identifier.toLowerCase()], (err, channel) => {
        if (err) return res.status(500).json({ error: "DB Error" });

        if (!channel) {
            // Si no, buscar por private_hash
            // El hash en la URL viene con "+" usualmente (ap.me/+hash), pero en BD es solo hex.
            // Limpiamos el +
            let potentialHash = identifier;
            if (potentialHash.startsWith('+') || potentialHash.startsWith('%2B')) { // Handle both cases just in case
                potentialHash = potentialHash.replace(/^(\+|%2B)/, '');
            } else if (identifier.match(/^[a-f0-9]+$/i)) {
                // Si es solo hex, usalo
                potentialHash = identifier;
            }

            db.get(`SELECT * FROM channels WHERE private_hash = ?`, [potentialHash], (err, privateChannel) => {
                if (err) return res.status(500).json({ error: "DB Error" });
                if (!privateChannel) return res.status(404).json({ error: "Canal no encontrado" });

                return sendPreview(privateChannel, userId, res);
            });
        } else {
            return sendPreview(channel, userId, res);
        }
    });
};

function sendPreview(channel, userId, res) {
    // Contar miembros
    db.get(`SELECT COUNT(*) as count FROM channel_members WHERE channel_id = ?`, [channel.id], (err, countRow) => {
        let isMember = false;

        const respond = () => {
            res.json({
                success: true,
                id: channel.id,
                name: channel.name,
                description: channel.description,
                avatar: channel.avatar,
                is_public: channel.is_public,
                memberCount: countRow ? countRow.count : 0,
                isMember: isMember,
                private_hash: channel.private_hash // Needed for join
            });
        };

        if (userId) {
            db.get(`SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?`, [channel.id, userId], (err, memberRow) => {
                if (memberRow) isMember = true;
                respond();
            });
        } else {
            respond();
        }
    });
}

exports.joinChannel = (req, res) => {
    const channelId = req.params.id;
    const userId = req.user.id;

    db.get(`SELECT is_public, private_hash FROM channels WHERE id = ?`, [channelId], (err, channel) => {
        if (err || !channel) return res.status(404).json({ error: "Canal no encontrado" });

        // Si es público -> Cualquiera entra
        // Si es privado -> Solo si fue invitado? 
        // El requerimiento dice "La única forma de acceso para no miembros debe ser mediante un enlace directo".
        // Si el usuario llama a este endpoint es porque tiene el ID.
        // Si tiene el ID, ¿asumimos que tiene acceso?
        // En UI, el modal sale SOLO si accedió por link (preview).
        // Aqui podríamos validar si el referer o alguna logica extra, pero simplificaremos:
        // Si el usuario TIENE el link PREVIEW (que ya valida hash), entonces puede unirse.
        // Pero este endpoint es POST /:id/join. 
        // Si el canal es privado, ¿deberíamos pedir el hash?
        // Por ahora, asumiremos que si llega al botón "Join" del modal, el usuario ya "vio" el canal.
        // Pero para seguridad estricta:
        // Si es PUBLICO: Libre.
        // Si es PRIVADO: Debería haber un token o el backend confía en que si conoce el ID es suficiente?
        // El ID es secuencial/predecible? SQLite rowid es predecible.
        // ENTONCES: Para canales PRIVADOS, este endpoint es INSEGURO si solo usa ID.
        // Debería requerir el private_hash en el body si es privado.

        // PERO, para no complicar el frontend que ya hice:
        // Voy a permitir unirse por ahora, O revisar si puedo pasar el hash.
        // El frontend renderJoinModal tiene el objeto channel completo (con private_hash si vino de search/preview).
        // Pero searchChannels NO devuelve private_hash si NO es miembro.
        // getChannelPreview SI devuelve private_hash si se busca por hash.
        // Si se busca por handle (publico), devuelve handle.

        // CORRECCION: SearchChannels devuelve private_hash en la query SQL que escribí?
        // SI: SELECT ..., c.private_hash. 
        // WAIT. Si searchChannels devuelve private_hash a NO miembros, entonces cualquiera puede unirse?
        // MI SQL dice: WHERE ( (c.is_public=0 AND (c.owner_id OR cm.user IS NOT NULL)) )
        // O SEA: Search NO devuelve canales privados a no miembros. BIEN.
        // Entonces, si un usuario NO miembro quiere unirse, solo puede hacerlo via LINK (+hash) -> Preview -> Join.
        // El preview por Link (+hash) obtiene el canal.
        // El modal tiene el ID.
        // Si yo hago POST /join/:id, un atacante podría adivinar IDs.
        // IMPLEMENTACION SEGURA: Si es privado, requerir `private_hash` (o algo) en body.
        // El frontend YA TIENE el hash si vino por preview de link, O no lo tiene si vino por... magia? NO.
        // El search no muestra privados.
        // ASI QUE: Solo se puede llegar al Join Modal de un privado via Deep Link (+hash).
        // El endpoint preview devuelve el hash? 
        // getChannelPreview -> sendPreview -> NO devuelve hash explicitamente en el JSON output, devuelve ID.
        // Mmmm.

        // Voy a permitir unirse si es publico. Si es privado, asumire que si el usuario llego aquí es valido, 
        // AUNQUE idealmente pediría el hash.
        // Retomando reglas: "Visibilidad en Búsqueda: ... NO aparezcan".
        // "Navegación por Link: ... único acceso".

        // Si es privado, validaremos que en el body venga el private_hash correcto.
        // EL frontend necesita enviar el hash.

        const { secret } = req.body;

        if (channel.is_public === 0) {
            if (channel.private_hash !== secret) {
                return res.status(403).json({ error: "Enlace inválido o expirado" });
            }
        }

        const now = new Date().toISOString();
        db.run(`INSERT OR IGNORE INTO channel_members (channel_id, user_id, joined_at) VALUES (?, ?, ?)`,
            [channelId, userId, now],
            function (err) {
                if (err) return res.status(500).json({ error: "Error al unirse" });
                try { getIo().emit('channels_update'); } catch (e) { }
                res.json({ success: true, message: "Unido correctamente" });
            }
        );
    });
};
