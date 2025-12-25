const { db } = require('../config/db');

const { decrypt } = require('../utils/encryption');

exports.searchUsers = (req, res) => {
    const query = req.query.q || '';

    if (!query || query.length < 2) {
        return res.json([]);
    }

    const searchTerm = query.replace('@', '').toLowerCase();

    db.all(
        `SELECT id, username, display_name, avatar, is_verified, is_admin, is_premium, bio 
         FROM users 
         WHERE username LIKE ? AND id != ? AND is_admin = 0
         LIMIT 20`,
        [`${searchTerm}%`, req.user.id],
        (err, rows) => {
            if (err) {
                console.error('Error searching users:', err);
                return res.status(500).json({ error: 'Error al buscar usuarios' });
            }
            res.json(rows || []);
        }
    );
};

exports.addContact = (req, res) => {
    const { contactUserId } = req.body;

    if (!contactUserId || contactUserId === req.user.id) {
        return res.status(400).json({ error: 'ID de contacto inválido' });
    }

    db.get('SELECT id FROM users WHERE id = ?', [contactUserId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        db.run(
            'INSERT OR IGNORE INTO contacts (user_id, contact_user_id) VALUES (?, ?)',
            [req.user.id, contactUserId],
            function (err) {
                if (err) {
                    console.error('Error adding contact:', err);
                    return res.status(500).json({ error: 'Error al agregar contacto' });
                }

                const { emitUsers } = require('../sockets/socketManager');
                emitUsers();

                res.json({ success: true, message: 'Contacto agregado' });
            }
        );
    });
};

exports.removeContact = (req, res) => {
    const contactUserId = parseInt(req.params.contactId);

    if (!contactUserId) {
        return res.status(400).json({ error: 'ID de contacto inválido' });
    }

    db.run(
        'DELETE FROM contacts WHERE user_id = ? AND contact_user_id = ?',
        [req.user.id, contactUserId],
        function (err) {
            if (err) {
                console.error('Error removing contact:', err);
                return res.status(500).json({ error: 'Error al eliminar contacto' });
            }

            const { emitUsers } = require('../sockets/socketManager');
            emitUsers();

            res.json({ success: true, message: 'Contacto eliminado' });
        }
    );
};

exports.getMyContacts = (req, res) => {
    db.all(
        `SELECT u.id, u.username, u.display_name, u.avatar, u.is_verified, u.is_admin, u.is_premium, u.bio,
        (SELECT content FROM messages WHERE (from_user_id = c.user_id AND to_user_id = u.id) OR (from_user_id = u.id AND to_user_id = c.user_id) ORDER BY id DESC LIMIT 1) as last_message,
        (SELECT timestamp FROM messages WHERE (from_user_id = c.user_id AND to_user_id = u.id) OR (from_user_id = u.id AND to_user_id = c.user_id) ORDER BY id DESC LIMIT 1) as last_message_time,
        (SELECT type FROM messages WHERE (from_user_id = c.user_id AND to_user_id = u.id) OR (from_user_id = u.id AND to_user_id = c.user_id) ORDER BY id DESC LIMIT 1) as last_message_type
         FROM contacts c
         JOIN users u ON c.contact_user_id = u.id
         WHERE c.user_id = ?
         ORDER BY last_message_time DESC, u.username`,
        [req.user.id],
        (err, rows) => {
            if (err) {
                console.error('Error getting contacts:', err);
                return res.status(500).json({ error: 'Error al obtener contactos' });
            }

            const contacts = (rows || []).map(row => {
                let lastMsg = null;
                if (row.last_message) {
                    if (row.last_message_type === 'image') lastMsg = '📷 Foto';
                    else if (row.last_message_type === 'sticker') lastMsg = '✨ Sticker';
                    else if (row.last_message_type === 'audio') lastMsg = '🎤 Mensaje de voz';
                    else {
                        try {
                            lastMsg = decrypt(row.last_message);
                        } catch (e) {
                            lastMsg = '🔒 Mensaje';
                        }
                    }
                }
                return {
                    id: row.id,
                    userId: row.id, // Compatible with socket payload
                    username: row.username,
                    display_name: row.display_name,
                    avatar: row.avatar,
                    is_verified: row.is_verified,
                    is_admin: row.is_admin,
                    is_premium: row.is_premium,
                    bio: row.bio,
                    lastMessage: lastMsg,
                    lastMessageTime: row.last_message_time
                };
            });

            res.json(contacts);
        }
    );
};
