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
const MODERATOR_PASSWORD = process.env.MOD_PASSWORD || 'CorkAdmin2026!';

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

db.exec(`
    CREATE TABLE IF NOT EXISTS help_requests (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
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
app.post('/api/items', upload.single('image'), async (req, res) => {
    const { title, description, category, donation, listed_by, image_url } = req.body;

    // Validation
    if (!title || !description || !donation || !listed_by) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const id = crypto.randomUUID();
    let image_path = '/images/Marketplace Graphic.jpg'; // default placeholder

    if (req.file) {
        image_path = '/uploads/' + req.file.filename;
    } else if (image_url) {
        // Download image from URL
        try {
            const urlObj = new URL(image_url);
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return res.status(400).json({ error: 'Invalid image URL.' });
            }
            const response = await fetch(image_url);
            if (!response.ok) throw new Error('Failed to fetch image');
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.startsWith('image/')) {
                return res.status(400).json({ error: 'URL does not point to an image.' });
            }
            const ext = contentType.split('/')[1].split(';')[0] || 'jpg';
            const filename = crypto.randomUUID() + '.' + ext;
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(path.join(uploadsDir, filename), buffer);
            image_path = '/uploads/' + filename;
        } catch (err) {
            return res.status(400).json({ error: 'Could not download image from URL: ' + err.message });
        }
    }

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

// DELETE /api/items/:id - Remove an item (moderator only)
app.delete('/api/items/:id', (req, res) => {
    const { id } = req.params;
    const modKey = req.headers['x-mod-key'] || '';
    if (modKey !== MODERATOR_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized. Moderator access required.' });
    }

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

// PATCH /api/items/:id - Edit an item (moderator only)
app.patch('/api/items/:id', (req, res) => {
    const { id } = req.params;
    const modKey = req.headers['x-mod-key'] || '';
    if (modKey !== MODERATOR_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized. Moderator access required.' });
    }

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!item) {
        return res.status(404).json({ error: 'Item not found.' });
    }

    const data = req.body;
    const title = (data.title || item.title).trim();
    const description = (data.description || item.description).trim();
    const category = (data.category || item.category).trim();
    const donation = Number(data.donation ?? item.donation);
    const claimed = data.claimed !== undefined ? Number(data.claimed) : item.claimed;
    const claimed_by = claimed ? item.claimed_by : null;
    const claimed_at = claimed ? item.claimed_at : null;

    db.prepare(`
        UPDATE items SET title = ?, description = ?, category = ?, donation = ?,
                         claimed = ?, claimed_by = ?, claimed_at = ? WHERE id = ?
    `).run(title, description, category, donation, claimed, claimed_by, claimed_at, id);

    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    res.json(updated);
});

// POST /api/mod/verify - Verify moderator password
app.post('/api/mod/verify', (req, res) => {
    const { password } = req.body || {};
    if (password === MODERATOR_PASSWORD) {
        return res.json({ success: true });
    }
    res.status(401).json({ error: 'Invalid password.' });
});

// GET /api/help - Get help requests (moderator only)
app.get('/api/help', (req, res) => {
    const modKey = req.headers['x-mod-key'] || '';
    if (modKey !== MODERATOR_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized.' });
    }
    const rows = db.prepare('SELECT * FROM help_requests ORDER BY created_at DESC').all();
    res.json(rows);
});

// POST /api/help - Submit a help request
app.post('/api/help', (req, res) => {
    const { name, message } = req.body;
    if (!name || !message) {
        return res.status(400).json({ error: 'Name and message are required.' });
    }
    if (message.length > 1000) {
        return res.status(400).json({ error: 'Message too long.' });
    }

    const id = crypto.randomUUID();
    db.prepare(
        'INSERT INTO help_requests (id, name, message) VALUES (?, ?, ?)'
    ).run(id, name.trim(), message.trim());

    // Send email notification (if nodemailer is available)
    try {
        const nodemailer = require('nodemailer');
        const smtpHost = process.env.SMTP_HOST;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        if (smtpHost && smtpUser && smtpPass) {
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: false,
                auth: { user: smtpUser, pass: smtpPass }
            });
            const adminEmails = (process.env.ADMIN_EMAILS || 'denise.osullivan@clearstream.com').split(',');
            transporter.sendMail({
                from: process.env.SMTP_FROM || smtpUser,
                to: adminEmails.join(', '),
                subject: `Cork Marketplace Help Request from ${name.trim()}`,
                text: `Help request from ${name.trim()}:\n\n${message.trim()}`
            }).catch(() => {});
        }
    } catch (_) {}

    res.status(201).json({ success: true });
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
