const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
    const token = req.cookies.chat_token;
    if (!token) return res.status(401).json({ error: 'Acceso denegado' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.clearCookie('chat_token');
            return res.status(403).json({ error: 'Token inválido' });
        }
        db.get(`SELECT is_admin, is_verified, is_premium FROM users WHERE id = ?`, [user.id], (dbErr, row) => {
            if (dbErr || !row) return res.status(403).json({ error: 'Usuario no encontrado' });
            req.user = { ...user, ...row };
            next();
        });
    });
};

module.exports = { authenticateToken };
