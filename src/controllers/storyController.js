const { db } = require('../config/db');
const { encrypt, decrypt } = require('../utils/encryption');

// Helper to get 24h expiration
const getExpirationDate = () => {
    const date = new Date();
    date.setHours(date.getHours() + 24);
    return date.toISOString();
};

exports.createStory = (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ error: 'Image required' });

    const userId = req.user.id;
    let mediaUrl = req.file.path; // Cloudinary URL
    // Force WebP
    if (mediaUrl.includes('/upload/') && !mediaUrl.includes('f_webp')) {
        mediaUrl = mediaUrl.replace('/upload/', '/upload/f_webp/');
    }
    const caption = req.body.caption ? encrypt(req.body.caption) : null;
    const expiresAt = getExpirationDate();
    const type = 'image'; // Default to image for now

    db.run(
        `INSERT INTO stories (user_id, media_url, caption, type, expires_at) VALUES (?, ?, ?, ?, ?)`,
        [userId, mediaUrl, caption, type, expiresAt],
        function (err) {
            if (err) {
                console.error("Error creating story:", err);
                return res.status(500).json({ error: 'DB Error' });
            }
            res.json({ id: this.lastID, mediaUrl, caption: req.body.caption, expiresAt });
        }
    );
};

exports.getStories = (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;
    const now = new Date().toISOString();

    // Get active stories from:
    // 1. My own stories
    // 2. Stories from people I have in contacts
    const sql = `
        SELECT s.id, s.user_id, s.media_url, s.caption, s.created_at, s.is_hidden, u.username, u.avatar, u.display_name,
        (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = ?) as is_viewed,
        (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) as view_count
        FROM stories s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN contacts c ON c.contact_user_id = s.user_id AND c.user_id = ?
        WHERE s.expires_at > ? 
        AND (s.user_id = ? OR c.contact_user_id IS NOT NULL)
        ORDER BY s.created_at ASC
    `;

    db.all(sql, [userId, userId, now, userId], (err, rows) => {
        if (err) {
            console.error("Error fetching stories:", err);
            return res.status(500).json({ error: 'DB Error' });
        }

        // Group by user
        const storiesByUser = {};

        rows.forEach(row => {
            // Filter hidden stories if they are not mine
            if (row.is_hidden && row.user_id !== userId) return;

            if (!storiesByUser[row.user_id]) {
                storiesByUser[row.user_id] = {
                    userId: row.user_id,
                    username: row.username,
                    displayName: row.display_name,
                    avatar: row.avatar,
                    stories: []
                };
            }

            let decryptedCaption = null;
            try {
                if (row.caption) decryptedCaption = decrypt(row.caption);
            } catch (e) {
                decryptedCaption = row.caption;
            }

            storiesByUser[row.user_id].stories.push({
                id: row.id,
                mediaUrl: row.media_url,
                caption: decryptedCaption,
                createdAt: row.created_at,
                isViewed: row.is_viewed > 0,
                viewCount: row.view_count, // Include view count
                isHidden: row.is_hidden // Include hidden status
            });
        });

        res.json(Object.values(storiesByUser));
    });
};

exports.markViewed = (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const storyId = req.params.id;
    const userId = req.user.id;

    db.run(
        `INSERT OR IGNORE INTO story_views (story_id, viewer_id) VALUES (?, ?)`,
        [storyId, userId],
        (err) => {
            if (err) console.error("Error marking view:", err);
            res.json({ success: true });
        }
    );
};

exports.deleteStory = (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const storyId = req.params.id;
    const userId = req.user.id;

    db.run(
        `DELETE FROM stories WHERE id = ? AND user_id = ?`,
        [storyId, userId],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true });
        }
    );
};

exports.hideStory = (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const storyId = req.params.id;
    const userId = req.user.id;

    // Toggle hidden status
    db.get(`SELECT is_hidden FROM stories WHERE id = ? AND user_id = ?`, [storyId, userId], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Story not found' });

        const newStatus = row.is_hidden ? 0 : 1;
        db.run(
            `UPDATE stories SET is_hidden = ? WHERE id = ?`,
            [newStatus, storyId],
            (err) => {
                if (err) return res.status(500).json({ error: 'DB Error' });
                res.json({ success: true, isHidden: newStatus === 1 });
            }
        );
    });
};

exports.editStory = (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const storyId = req.params.id;
    const userId = req.user.id;
    const { caption } = req.body;

    const encryptedCaption = caption ? encrypt(caption) : null;

    db.run(
        `UPDATE stories SET caption = ? WHERE id = ? AND user_id = ?`,
        [encryptedCaption, storyId, userId],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true });
        }
    );
};

exports.getStoryViewers = (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const storyId = req.params.id;
    const userId = req.user.id;

    // Verify ownership
    db.get(`SELECT user_id FROM stories WHERE id = ?`, [storyId], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Story not found' });
        if (row.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

        const sql = `
            SELECT u.id, u.username, u.display_name, u.avatar, sv.viewed_at
            FROM story_views sv
            JOIN users u ON sv.viewer_id = u.id
            WHERE sv.story_id = ?
            ORDER BY sv.viewed_at DESC
        `;

        db.all(sql, [storyId], (err, rows) => {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json(rows);
        });
    });
};
