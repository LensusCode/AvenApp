const { db } = require('../config/db');
const { emitUsers } = require('../sockets/socketManager');

exports.getMe = (req, res) => {
    db.get(`SELECT id, username, display_name, bio, avatar, is_admin, is_verified, is_premium FROM users WHERE id = ?`, [req.user.id], (err, row) => {
        if (row) res.json(row);
        else res.status(401).json({ error: 'No encontrado' });
    });
};

exports.updateProfile = (req, res) => {
    const { field, value } = req.body;
    const allowedFields = ['username', 'display_name', 'bio'];
    if (!allowedFields.includes(field)) return res.status(400).json({ error: 'Campo inválido' });
    let finalValue = value ? value.trim() : '';
    if (field === 'username' && (finalValue.length < 3 || finalValue.length > 20)) return res.status(400).json({ error: 'Usuario: 3-20 caracteres' });

    db.run(`UPDATE users SET ${field} = ? WHERE id = ?`, [finalValue, req.user.id], function (err) {
        if (err) return res.status(400).json({ error: 'Error o usuario duplicado' });
        emitUsers();
        res.json({ success: true, field, value: finalValue });
    });
};

exports.uploadAvatar = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió imagen' });

    try {
        let avatarUrl = req.file.path;
        const splitUrl = avatarUrl.split('/upload/');
        if (splitUrl.length === 2) {
            avatarUrl = `${splitUrl[0]}/upload/w_500,h_500,c_fill,g_face/${splitUrl[1]}`;
        }

        db.run(`UPDATE users SET avatar = ? WHERE id = ?`, [avatarUrl, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Error DB' });
            // We need io to emit 'user_updated_profile'. 
            // I'll import getIo from socketManager
            const { getIo } = require('../sockets/socketManager');
            try {
                getIo().emit('user_updated_profile', { userId: req.user.id, avatar: avatarUrl });
            } catch (e) { }
            res.json({ avatarUrl });
        });
    } catch (error) {
        console.error("Error Avatar:", error);
        res.status(500).json({ error: 'Error procesando avatar' });
    }
};

exports.toggleVerify = (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'No autorizado' });
    db.run(`UPDATE users SET is_verified = 1 - is_verified WHERE id = ?`, [req.body.targetUserId], function (err) {
        if (err) return res.status(500).json({ error: 'Error' });
        emitUsers(); res.json({ success: true });
    });
};

exports.togglePremium = (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'No autorizado' });
    db.run(`UPDATE users SET is_premium = 1 - IFNULL(is_premium, 0) WHERE id = ?`, [req.body.targetUserId], function (err) {
        if (err) return res.status(500).json({ error: 'Error DB' });
        emitUsers(); res.json({ success: true });
    });
};

exports.getAllUsers = (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'No autorizado' });

    db.all(`SELECT id, username, display_name, avatar, is_admin, is_verified, is_premium, bio FROM users ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
};
