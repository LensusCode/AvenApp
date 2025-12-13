const { db } = require('../config/db');

exports.searchUsers = (req, res) => {
    const query = req.query.q || '';

    if (!query || query.length < 2) {
        return res.json([]);
    }

    const searchTerm = query.replace('@', '').toLowerCase();

    db.all(
        `SELECT id, username, display_name, avatar, is_verified, is_admin, is_premium, bio 
         FROM users 
         WHERE LOWER(username) LIKE ? AND id != ? AND is_admin = 0
         LIMIT 20`,
        [`%${searchTerm}%`, req.user.id],
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
        `SELECT u.id, u.username, u.display_name, u.avatar, u.is_verified, u.is_admin, u.is_premium, u.bio
         FROM contacts c
         JOIN users u ON c.contact_user_id = u.id
         WHERE c.user_id = ?
         ORDER BY u.username`,
        [req.user.id],
        (err, rows) => {
            if (err) {
                console.error('Error getting contacts:', err);
                return res.status(500).json({ error: 'Error al obtener contactos' });
            }
            res.json(rows || []);
        }
    );
};
