const jwt = require('jsonwebtoken');
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
        req.user = user;
        next();
    });
};

module.exports = { authenticateToken };
