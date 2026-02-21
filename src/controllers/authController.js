const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

exports.register = async (req, res) => {
    const { username, password, firstName, lastName } = req.body;
    if (!username || !password || !firstName || !lastName) return res.status(400).json({ error: 'Datos incompletos' });
    if (password.length < 8) return res.status(400).json({ error: 'Contraseña corta' });
    if (username.length > 20) return res.status(400).json({ error: 'Usuario largo' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        const createdAt = new Date().toISOString();

        db.run(`INSERT INTO users (username, password, avatar, display_name, created_at) VALUES (?, ?, ?, ?, ?)`,
            [username, hash, '/profile.png', fullName, createdAt], function (err) {
                if (err) return res.status(400).json({ error: 'Usuario existe' });
                res.json({ id: this.lastID });
            });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error interno' });
    }
};

exports.login = (req, res) => {
    const { username, password } = req.body;
    const SUPER_ADMIN_ENV = process.env.SUPER_ADMIN_USER;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, row) => {
        if (err || !row) {
            return res.status(400).json({ error: 'Credenciales incorrectas' });
        }

        if (row.locked_until) {
            const lockedUntil = new Date(row.locked_until);
            if (new Date() < lockedUntil) {
                return res.status(423).json({ error: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta más tarde.' });
            } else {
                db.run(`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?`, [row.id]);
            }
        }

        const match = await bcrypt.compare(password, row.password);
        if (!match) {
            const currentAttempts = (row.failed_attempts || 0) + 1;
            if (currentAttempts >= 5) {
                const lockTime = new Date();
                lockTime.setMinutes(lockTime.getMinutes() + 15);
                db.run(`UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?`, [currentAttempts, lockTime.toISOString(), row.id]);
                return res.status(423).json({ error: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta más tarde.' });
            } else {
                db.run(`UPDATE users SET failed_attempts = ? WHERE id = ?`, [currentAttempts, row.id]);
                return res.status(400).json({ error: 'Credenciales incorrectas' });
            }
        }

        db.run(`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?`, [row.id]);

        if (SUPER_ADMIN_ENV && row.username === SUPER_ADMIN_ENV && row.is_admin !== 1) {
            db.run(`UPDATE users SET is_admin = 1, is_verified = 1 WHERE id = ?`, [row.id]);
            row.is_admin = 1; row.is_verified = 1;
        }

        const token = jwt.sign({ id: row.id, username: row.username }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('chat_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });

        res.json({ success: true, user: { id: row.id, username: row.username, display_name: row.display_name, bio: row.bio, avatar: row.avatar || '/profile.png', is_admin: row.is_admin, is_verified: row.is_verified, is_premium: row.is_premium } });
    });
};

exports.logout = (req, res) => {
    res.clearCookie('chat_token');
    res.json({ success: true });
};

exports.getMe = (req, res) => {
    // req.user is populated by authenticateToken middleware
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch full user details to be sure (optional, but good for data consistency)
    db.get(`SELECT id, username, display_name, bio, avatar, is_admin, is_verified, is_premium FROM users WHERE id = ?`, [req.user.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'User not found' });
        res.json(row);
    });
};

exports.checkUsername = (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Vacío' });
    db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, row) => {
        if (err) return res.status(500).json({ error: "DB Error" });
        res.json({ available: !row });
    });
};
