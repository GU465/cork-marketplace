"""
Cork Marketplace - Backend Server
Python + Flask + SQLite for shared multi-user access
"""

import os
import uuid
import sqlite3
import hashlib
import hmac
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='public', static_url_path='')

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# On Azure, use /home for persistent writable storage; locally use project dir
DATA_DIR = os.environ.get('DATA_DIR', BASE_DIR)
UPLOAD_FOLDER = os.path.join(DATA_DIR, 'public', 'uploads')
DB_PATH = os.path.join(DATA_DIR, 'marketplace.db')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5MB

# Moderator password - change this to whatever you want
MODERATOR_PASSWORD = os.environ.get('MOD_PASSWORD', 'CorkAdmin2026!')

app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def get_db():
    """Get database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Initialize database tables."""
    conn = get_db()
    conn.execute('''
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
            created_at TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def row_to_dict(row):
    """Convert a sqlite3.Row to a dictionary."""
    if row is None:
        return None
    return dict(row)


# ===== Routes =====

@app.route('/')
def index():
    """Serve the frontend."""
    return send_from_directory('public', 'index.html')


@app.route('/api/items', methods=['GET'])
def get_items():
    """Fetch all items, newest first."""
    conn = get_db()
    rows = conn.execute('SELECT * FROM items ORDER BY created_at DESC').fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route('/api/items', methods=['POST'])
def create_item():
    """Create a new item listing."""
    # Check for image file
    if 'image' not in request.files:
        return jsonify({'error': 'An image is required.'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No image selected.'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Only image files (jpg, png, gif, webp) are allowed.'}), 400

    # Get form fields
    title = request.form.get('title', '').strip()
    description = request.form.get('description', '').strip()
    category = request.form.get('category', 'other').strip()
    donation = request.form.get('donation', '').strip()
    listed_by = request.form.get('listed_by', '').strip()

    # Validation
    if not title:
        return jsonify({'error': 'Title is required.'}), 400
    if not description:
        return jsonify({'error': 'Description is required.'}), 400
    if not donation:
        return jsonify({'error': 'Donation amount is required.'}), 400
    if not listed_by:
        return jsonify({'error': 'Your name is required.'}), 400

    try:
        donation_amount = float(donation)
        if donation_amount < 0:
            raise ValueError()
    except ValueError:
        return jsonify({'error': 'Invalid donation amount.'}), 400

    # Save image
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(UPLOAD_FOLDER, filename))
    image_path = f"/uploads/{filename}"

    # Save to database
    item_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat() + 'Z'

    conn = get_db()
    conn.execute('''
        INSERT INTO items (id, title, description, category, donation, image_path, listed_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (item_id, title, description, category, donation_amount, image_path, listed_by, created_at))
    conn.commit()

    row = conn.execute('SELECT * FROM items WHERE id = ?', (item_id,)).fetchone()
    conn.close()

    return jsonify(row_to_dict(row)), 201


@app.route('/api/items/<item_id>/claim', methods=['PATCH'])
def claim_item(item_id):
    """Claim an item."""
    data = request.get_json()
    if not data or not data.get('claimed_by', '').strip():
        return jsonify({'error': 'Your name is required to claim an item.'}), 400

    claimed_by = data['claimed_by'].strip()

    conn = get_db()
    row = conn.execute('SELECT * FROM items WHERE id = ?', (item_id,)).fetchone()

    if row is None:
        conn.close()
        return jsonify({'error': 'Item not found.'}), 404

    if row['claimed']:
        conn.close()
        return jsonify({'error': 'Item already claimed.'}), 409

    claimed_at = datetime.utcnow().isoformat() + 'Z'
    conn.execute('''
        UPDATE items SET claimed = 1, claimed_by = ?, claimed_at = ? WHERE id = ?
    ''', (claimed_by, claimed_at, item_id))
    conn.commit()

    updated = conn.execute('SELECT * FROM items WHERE id = ?', (item_id,)).fetchone()
    conn.close()

    return jsonify(row_to_dict(updated))


@app.route('/api/items/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    """Delete an item (moderator only)."""
    mod_key = request.headers.get('X-Mod-Key', '')
    if not hmac.compare_digest(mod_key, MODERATOR_PASSWORD):
        return jsonify({'error': 'Unauthorized. Moderator access required.'}), 403

    conn = get_db()
    row = conn.execute('SELECT * FROM items WHERE id = ?', (item_id,)).fetchone()

    if row is None:
        conn.close()
        return jsonify({'error': 'Item not found.'}), 404

    # Delete image file
    if row['image_path']:
        image_file = os.path.join(BASE_DIR, 'public', row['image_path'].lstrip('/'))
        if os.path.exists(image_file):
            os.remove(image_file)

    conn.execute('DELETE FROM items WHERE id = ?', (item_id,))
    conn.commit()
    conn.close()

    return jsonify({'success': True})


@app.route('/api/items/<item_id>', methods=['PATCH'])
def edit_item(item_id):
    """Edit an item (moderator only)."""
    mod_key = request.headers.get('X-Mod-Key', '')
    if not hmac.compare_digest(mod_key, MODERATOR_PASSWORD):
        return jsonify({'error': 'Unauthorized. Moderator access required.'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided.'}), 400

    conn = get_db()
    row = conn.execute('SELECT * FROM items WHERE id = ?', (item_id,)).fetchone()

    if row is None:
        conn.close()
        return jsonify({'error': 'Item not found.'}), 404

    # Update allowed fields
    title = data.get('title', row['title']).strip()
    description = data.get('description', row['description']).strip()
    category = data.get('category', row['category']).strip()
    donation = data.get('donation', row['donation'])

    try:
        donation = float(donation)
    except (ValueError, TypeError):
        conn.close()
        return jsonify({'error': 'Invalid donation amount.'}), 400

    # Allow moderator to unclaim an item
    claimed = data.get('claimed', row['claimed'])
    claimed_by = row['claimed_by'] if claimed else None
    claimed_at = row['claimed_at'] if claimed else None

    conn.execute('''
        UPDATE items SET title = ?, description = ?, category = ?, donation = ?,
                         claimed = ?, claimed_by = ?, claimed_at = ?
        WHERE id = ?
    ''', (title, description, category, donation, int(claimed), claimed_by, claimed_at, item_id))
    conn.commit()

    updated = conn.execute('SELECT * FROM items WHERE id = ?', (item_id,)).fetchone()
    conn.close()

    return jsonify(row_to_dict(updated))


@app.route('/api/mod/verify', methods=['POST'])
def verify_mod():
    """Verify moderator password."""
    data = request.get_json()
    password = data.get('password', '') if data else ''

    if hmac.compare_digest(password, MODERATOR_PASSWORD):
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Invalid password.'}), 401


# ===== Main =====
if __name__ == '__main__':
    init_db()
    print("\n  🟢 Cork Marketplace running at http://localhost:3000\n")
    app.run(host='0.0.0.0', port=3000, debug=True)
