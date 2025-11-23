require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
// CAMBIO: Reemplazamos sqlite3 por pg (PostgreSQL)
const { Pool } = require('pg'); 
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURACIÓN DE ENCRIPTACIÓN ---
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; 
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

// --- BASE DE DATOS (POSTGRESQL) ---
// CAMBIO: Configuración del Pool de conexiones para Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Requerido por Render
});

// CAMBIO: Inicialización asíncrona de tablas con sintaxis Postgres
const initDB = async () => {
    try {
        // Usuarios (SERIAL en vez de AUTOINCREMENT)
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT,
            avatar TEXT
        )`);

        // Mensajes (TIMESTAMP en vez de DATETIME)
        await pool.query(`CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            from_user_id INTEGER,
            to_user_id INTEGER,
            content TEXT,
            type TEXT DEFAULT 'text',
            is_deleted INTEGER DEFAULT 0,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Nicknames
        await pool.query(`CREATE TABLE IF NOT EXISTS nicknames (
            user_id INTEGER,
            target_user_id INTEGER,
            nickname TEXT,
            PRIMARY KEY (user_id, target_user_id)
        )`);
        
        console.log('Base de datos PostgreSQL conectada y tablas verificadas.');
    } catch (err) {
        console.error('Error inicializando la BD:', err);
    }
};
initDB();

// --- API RUTAS ---

// CAMBIO: Sintaxis $1, $2 y RETURNING id
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if(!username || !password) return res.status(400).json({error: 'Faltan datos'});
    const hash = bcrypt.hashSync(password, 10);
    
    try {
        const result = await pool.query(
            `INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id`, 
            [username, hash]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        // Error código 23505 es violación de unicidad en Postgres
        if (err.code === '23505') return res.status(400).json({ error: 'Usuario existente' });
        res.status(500).json({ error: 'Error interno' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
        const row = result.rows[0];

        if (!row) return res.status(400).json({ error: 'Usuario no encontrado' });
        if (!bcrypt.compareSync(password, row.password)) return res.status(400).json({ error: 'Contraseña incorrecta' });
        
        res.json({ user: { id: row.id, username: row.username, avatar: row.avatar } });
    } catch (err) {
        res.status(500).json({ error: 'Error de servidor' });
    }
});

// Subir Avatar
// NOTA: Las imágenes en disco ('./public/uploads') SE BORRARÁN al reiniciar Render.
// La base de datos (usuarios/chats) SÍ persistirá con este código.
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
        
        // CAMBIO: Update con sintaxis Postgres
        await pool.query(`UPDATE users SET avatar = $1 WHERE id = $2`, [avatarUrl, userId]);
        res.json({ avatarUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error procesando imagen' });
    }
});

// Subir Imagen Chat
app.post('/api/upload-chat-image', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No hay imagen' });

    const dir = './public/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `chat-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpeg`;
    const filepath = path.join(dir, filename);

    try {
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

app.get('/api/messages/:myId/:otherId', async (req, res) => {
    const { myId, otherId } = req.params;
    // CAMBIO: Sintaxis $1, $2...
    const sql = `
        SELECT * FROM messages 
        WHERE ((from_user_id = $1 AND to_user_id = $2) 
           OR (from_user_id = $3 AND to_user_id = $4))
           AND is_deleted = 0
        ORDER BY timestamp ASC
    `;
    try {
        const result = await pool.query(sql, [myId, otherId, otherId, myId]);
        const decryptedRows = result.rows.map(row => ({ ...row, content: decrypt(row.content) }));
        res.json(decryptedRows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error DB' });
    }
});

// --- RUTA PING PARA EL BOT (EVITAR HIBERNACIÓN) ---
app.get('/ping', (req, res) => {
    res.send('Pong! App is awake.');
});

// --- SOCKET.IO ---

io.on('connection', (socket) => {
    const user = socket.handshake.auth;
    socket.data.userId = user.userId;
    socket.data.username = user.username;
    socket.join(`user_${user.userId}`);

    // Cargar Avatar
    pool.query(`SELECT avatar FROM users WHERE id = $1`, [user.userId])
        .then(res => {
            if(res.rows[0]) socket.data.avatar = res.rows[0].avatar;
            emitUsers();
        });

    // Cargar Nicknames
    pool.query(`SELECT target_user_id, nickname FROM nicknames WHERE user_id = $1`, [user.userId])
        .then(res => {
            const map = {};
            res.rows.forEach(r => map[r.target_user_id] = r.nickname);
            socket.emit('nicknames', map);
        });

    console.log(`Conectado: ${user.username}`);

    socket.on('avatar updated', (url) => {
        socket.data.avatar = url;
        emitUsers();
    });

    socket.on('set nickname', async ({ targetUserId, nickname }) => {
        const userId = socket.data.userId;
        try {
            if(!nickname || nickname.trim() === "") {
                await pool.query(`DELETE FROM nicknames WHERE user_id = $1 AND target_user_id = $2`, [userId, targetUserId]);
            } else {
                // CAMBIO: "UPSERT" en Postgres (INSERT ... ON CONFLICT)
                await pool.query(`
                    INSERT INTO nicknames (user_id, target_user_id, nickname) VALUES ($1, $2, $3)
                    ON CONFLICT (user_id, target_user_id) DO UPDATE SET nickname = $3
                `, [userId, targetUserId, nickname.trim()]);
            }
        } catch(e) { console.error("Error setting nickname", e); }
    });

    socket.on('private message', async ({ content, toUserId, type = 'text' }, callback) => {
        const fromUserId = socket.data.userId;
        const encryptedContent = encrypt(content);

        try {
            // CAMBIO: Insertar y retornar ID en una sola consulta
            const res = await pool.query(
                `INSERT INTO messages (from_user_id, to_user_id, content, type) VALUES ($1, $2, $3, $4) RETURNING id`, 
                [fromUserId, toUserId, encryptedContent, type]
            );
            
            const newMessageId = res.rows[0].id;
            
            socket.to(`user_${toUserId}`).emit('private message', {
                id: newMessageId, 
                content: content,
                type: type,
                fromUserId: fromUserId,
                timestamp: new Date().toISOString()
            });
            
            if (callback) callback({ id: newMessageId });
        } catch (err) {
            console.error("Error enviando mensaje:", err);
        }
    });

    socket.on('delete message', async ({ messageId, toUserId }) => {
        const userId = socket.data.userId;
        // CAMBIO: Syntax Postgres
        const sql = `UPDATE messages SET is_deleted = 1 WHERE id = $1 AND from_user_id = $2`;
        try {
            await pool.query(sql, [messageId, userId]);
            socket.to(`user_${toUserId}`).emit('message deleted', { messageId });
            socket.emit('message deleted', { messageId });
        } catch(e) { console.error(e); }
    });

    socket.on('typing', ({ toUserId }) => {
        socket.to(`user_${toUserId}`).emit('typing', { fromUserId: socket.data.userId, username: socket.data.username });
    });
    socket.on('stop typing', ({ toUserId }) => {
        socket.to(`user_${toUserId}`).emit('stop typing', { fromUserId: socket.data.userId });
    });
    socket.on('disconnect', () => { emitUsers(); });

    function emitUsers() {
        pool.query(`SELECT id, username, avatar FROM users`).then(res => {
            const onlineUserIds = new Set();
            for (let [id, socket] of io.of("/").sockets) {
                if (socket.data.userId) onlineUserIds.add(socket.data.userId);
            }
            const users = res.rows.map(row => ({
                userId: row.id,
                username: row.username,
                avatar: row.avatar,
                online: onlineUserIds.has(row.id)
            }));
            io.emit('users', users);
        }).catch(err => console.error("Error fetching users", err));
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});