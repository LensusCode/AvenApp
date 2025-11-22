const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURACIÓN DE ENCRIPTACIÓN ---
const ENCRYPTION_KEY = '12345678901234567890123456789012'; 
const IV_LENGTH = 16; 

function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return '';
    try {
        let textParts = text.split(':');
        let iv = Buffer.from(textParts.shift(), 'hex');
        let encryptedText = Buffer.from(textParts.join(':'), 'hex');
        let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        return '[Error desencriptando]';
    }
}

// --- CONFIGURACIÓN MULTER ---
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos de imagen'), false);
    }
};
const upload = multer({ storage: storage, fileFilter: fileFilter });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- BASE DE DATOS ---
const dbPath = path.join(__dirname, 'chat.db');
const db = new sqlite3.Database(dbPath, (err) => { 
    if (err) console.error(err.message);
    else console.log('Conectado a la base de datos SQLite.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        avatar TEXT
    )`);

    // MODIFICADO: Agregamos columna 'type'
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER,
        to_user_id INTEGER,
        content TEXT,
        type TEXT DEFAULT 'text',
        is_deleted INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (!err) {
            // Migración simple por si la tabla ya existe
            db.run(`ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0`, () => {});
            db.run(`ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'text'`, () => {});
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS nicknames (
        user_id INTEGER,
        target_user_id INTEGER,
        nickname TEXT,
        PRIMARY KEY (user_id, target_user_id)
    )`);
});

// --- API RUTAS ---

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if(!username || !password) return res.status(400).json({error: 'Faltan datos'});
    const hash = bcrypt.hashSync(password, 10);
    
    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], function(err) {
        if (err) return res.status(400).json({ error: 'Usuario existente' });
        res.json({ id: this.lastID });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
        if (err || !row) return res.status(400).json({ error: 'Usuario no encontrado' });
        if (!bcrypt.compareSync(password, row.password)) return res.status(400).json({ error: 'Contraseña incorrecta' });
        res.json({ user: { id: row.id, username: row.username, avatar: row.avatar } });
    });
});

// Subir Avatar
app.post('/api/upload-avatar', upload.single('avatar'), async (req, res) => {
    const userId = req.body.userId;
    if (!req.file || !userId) return res.status(400).json({ error: 'Faltan datos' });

    const dir = './public/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `avatar-${userId}-${Date.now()}.jpeg`;
    const filepath = path.join(dir, filename);

    try {
        await sharp(req.file.buffer)
            .resize(500, 500, { fit: 'cover', position: 'center' })
            .toFormat('jpeg')
            .jpeg({ quality: 80, mozjpeg: true })
            .toFile(filepath);

        const avatarUrl = `/uploads/${filename}`;
        db.run(`UPDATE users SET avatar = ? WHERE id = ?`, [avatarUrl, userId], (err) => {
            if (err) return res.status(500).json({error: 'Error DB'});
            res.json({ avatarUrl });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error procesando imagen' });
    }
});

// NUEVO: Subir Imagen Chat
app.post('/api/upload-chat-image', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No hay imagen' });

    const dir = './public/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Generar nombre único
    const filename = `chat-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpeg`;
    const filepath = path.join(dir, filename);

    try {
        // Compresión para chat (Max 1024px, borra metadatos)
        await sharp(req.file.buffer)
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
            .toFormat('jpeg')
            .jpeg({ quality: 80, mozjpeg: true })
            .toFile(filepath);

        res.json({ imageUrl: `/uploads/${filename}` });

    } catch (error) {
        console.error('Error imagen chat:', error);
        res.status(500).json({ error: 'Error procesando imagen' });
    }
});

app.get('/api/messages/:myId/:otherId', (req, res) => {
    const { myId, otherId } = req.params;
    const sql = `
        SELECT * FROM messages 
        WHERE ((from_user_id = ? AND to_user_id = ?) 
           OR (from_user_id = ? AND to_user_id = ?))
           AND is_deleted = 0
        ORDER BY timestamp ASC
    `;
    db.all(sql, [myId, otherId, otherId, myId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error DB' });
        const decryptedRows = rows.map(row => ({ ...row, content: decrypt(row.content) }));
        res.json(decryptedRows);
    });
});

// --- SOCKET.IO ---

io.on('connection', (socket) => {
    const user = socket.handshake.auth;
    socket.data.userId = user.userId;
    socket.data.username = user.username;
    socket.join(`user_${user.userId}`);

    db.get(`SELECT avatar FROM users WHERE id = ?`, [user.userId], (err, row) => {
        if(row) socket.data.avatar = row.avatar;
        emitUsers();
    });

    db.all(`SELECT target_user_id, nickname FROM nicknames WHERE user_id = ?`, [user.userId], (err, rows) => {
        if(!err && rows) {
            const map = {};
            rows.forEach(r => map[r.target_user_id] = r.nickname);
            socket.emit('nicknames', map);
        }
    });

    console.log(`Conectado: ${user.username}`);

    socket.on('avatar updated', (url) => {
        socket.data.avatar = url;
        emitUsers();
    });

    socket.on('set nickname', ({ targetUserId, nickname }) => {
        const userId = socket.data.userId;
        if(!nickname || nickname.trim() === "") {
            db.run(`DELETE FROM nicknames WHERE user_id = ? AND target_user_id = ?`, [userId, targetUserId]);
        } else {
            db.run(`INSERT OR REPLACE INTO nicknames (user_id, target_user_id, nickname) VALUES (?, ?, ?)`, 
                [userId, targetUserId, nickname.trim()]);
        }
    });

    // MODIFICADO: Acepta 'type' (text o image)
    socket.on('private message', ({ content, toUserId, type = 'text' }, callback) => {
        const fromUserId = socket.data.userId;
        const encryptedContent = encrypt(content); // URL también se encripta

        db.run(`INSERT INTO messages (from_user_id, to_user_id, content, type) VALUES (?, ?, ?, ?)`, 
            [fromUserId, toUserId, encryptedContent, type], 
            function(err) {
                if (err) return console.error(err);
                const newMessageId = this.lastID;
                
                socket.to(`user_${toUserId}`).emit('private message', {
                    id: newMessageId, 
                    content: content,
                    type: type, // Enviamos el tipo al destinatario
                    fromUserId: fromUserId,
                    timestamp: new Date().toISOString()
                });
                
                if (callback) callback({ id: newMessageId });
            }
        );
    });

    socket.on('delete message', ({ messageId, toUserId }) => {
        const userId = socket.data.userId;
        const sql = `UPDATE messages SET is_deleted = 1 WHERE id = ? AND from_user_id = ?`;
        db.run(sql, [messageId, userId], function(err) {
            if (this.changes > 0) {
                socket.to(`user_${toUserId}`).emit('message deleted', { messageId });
                socket.emit('message deleted', { messageId });
            }
        });
    });

    socket.on('typing', ({ toUserId }) => {
        socket.to(`user_${toUserId}`).emit('typing', { fromUserId: socket.data.userId, username: socket.data.username });
    });
    socket.on('stop typing', ({ toUserId }) => {
        socket.to(`user_${toUserId}`).emit('stop typing', { fromUserId: socket.data.userId });
    });
    socket.on('disconnect', () => { emitUsers(); });

    function emitUsers() {
        db.all(`SELECT id, username, avatar FROM users`, (err, rows) => {
            if (err) return;
            const onlineUserIds = new Set();
            for (let [id, socket] of io.of("/").sockets) {
                if (socket.data.userId) onlineUserIds.add(socket.data.userId);
            }
            const users = rows.map(row => ({
                userId: row.id,
                username: row.username,
                avatar: row.avatar,
                online: onlineUserIds.has(row.id)
            }));
            io.emit('users', users);
        });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});