/**
 * Cork Marketplace - Backend Server
 * Node.js + Express + SQLite for shared multi-user access
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_PASSWORD = process.env.SITE_PASSWORD || 'CorkMarket2026';

// ===== Basic Authentication =====
app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Cork Marketplace"');
        return res.status(401).send('Authentication required.');
    }
    const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString();
    const [user, pass] = credentials.split(':');
    if (pass === SITE_PASSWORD) {
        return next();
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Cork Marketplace"');
    return res.status(401).send('Invalid credentials.');
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// ===== Database Setup =====
const db = new Database(path.join(__dirname, 'marketplace.db'));
db.pragma('journal_mode = WAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        donation REAL NOT NULL,
        image_path TEXT NOT NULL,
        listed_by TEXT NOT NULL,
        claimed INTEGER NOT NULL DEFAULT 0,
        claimed_by TEXT,
        claimed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
`);

// ===== Middleware =====
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== File Upload Config =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueName = crypto.randomUUID() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed.'));
        }
    }
});

// ===== API Routes =====

// GET /api/items - Fetch all items (newest first)
app.get('/api/items', (req, res) => {
    const items = db.prepare(`
        SELECT * FROM items ORDER BY created_at DESC
    `).all();
    res.json(items);
});

// POST /api/items - Create a new item listing
app.post('/api/items', upload.single('image'), (req, res) => {
    const { title, description, category, donation, listed_by } = req.body;

    // Validation
    if (!title || !description || !donation || !listed_by) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'An image is required.' });
    }

    const id = crypto.randomUUID();
    const image_path = '/uploads/' + req.file.filename;

    const stmt = db.prepare(`
        INSERT INTO items (id, title, description, category, donation, image_path, listed_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, title.trim(), description.trim(), category || 'other', Number(donation), image_path, listed_by.trim());

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    res.status(201).json(item);
});

// PATCH /api/items/:id/claim - Claim an item
app.patch('/api/items/:id/claim', (req, res) => {
    const { id } = req.params;
    const { claimed_by } = req.body;

    if (!claimed_by) {
        return res.status(400).json({ error: 'Your name is required to claim an item.' });
    }

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!item) {
        return res.status(404).json({ error: 'Item not found.' });
    }
    if (item.claimed) {
        return res.status(409).json({ error: 'Item already claimed.' });
    }

    db.prepare(`
        UPDATE items SET claimed = 1, claimed_by = ?, claimed_at = datetime('now') WHERE id = ?
    `).run(claimed_by.trim(), id);

    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    res.json(updated);
});

// DELETE /api/items/:id - Remove an item (only by lister)
app.delete('/api/items/:id', (req, res) => {
    const { id } = req.params;
    const { user } = req.body;

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!item) {
        return res.status(404).json({ error: 'Item not found.' });
    }

    // Delete image file
    const imagePath = path.join(__dirname, 'public', item.image_path);
    if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
    }

    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    res.json({ success: true });
});

// ===== Error handling for multer =====
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'File upload error: ' + err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

// ===== Start Server =====
app.listen(PORT, () => {
    console.log(`\n  🟢 Cork Marketplace running at http://localhost:${PORT}\n`);
});
