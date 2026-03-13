var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var { authenticateToken } = require("../middleware/authorize");

/* POST send a message. */
router.post("/", authenticateToken, async function (req, res, next) {
  try {
    const { receiver_id, content, recipe_id, list_id } = req.body;

    // Verify friendship (mutual follow)
    const friendCheck = await pool.query(
      `SELECT 1 FROM follows f1 
       JOIN follows f2 ON f1.following_id = f2.follower_id 
       WHERE f1.follower_id = $1 AND f1.following_id = $2 AND f2.following_id = $1`,
      [req.user.id, receiver_id]
    );

    if (friendCheck.rows.length === 0) {
      return res.status(403).json({ error: "You can only message friends" });
    }

    const result = await pool.query(
      "INSERT INTO messages (sender_id, receiver_id, content, recipe_id, list_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.user.id, receiver_id, content, recipe_id, list_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* PUT mark messages as read/unread. */
router.put("/read", authenticateToken, async function (req, res, next) {
  try {
    const { message_ids, is_read } = req.body;

    if (!Array.isArray(message_ids) || message_ids.length === 0) {
      return res.status(400).json({ error: "message_ids must be a non-empty array" });
    }

    // Default to true if not provided, otherwise use boolean value
    const status = is_read === undefined ? true : !!is_read;

    const result = await pool.query(
      "UPDATE messages SET is_read = $1 WHERE id = ANY($2::bigint[]) AND receiver_id = $3 RETURNING *",
      [status, message_ids, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET conversation threads (Inbox). */
router.get("/threads", authenticateToken, async function (req, res, next) {
  try {
    const currentUserId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    // Get the most recent message for every unique conversation partner
    const result = await pool.query(
      `WITH last_messages AS (
         SELECT DISTINCT ON (
           CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END
         )
         m.*,
         CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as other_user_id
         FROM messages m
         WHERE sender_id = $1 OR receiver_id = $1
         ORDER BY 
           CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END,
           created_at DESC
       )
       SELECT lm.*, u.username as other_username
       FROM last_messages lm
       JOIN users u ON lm.other_user_id = u.id
       ORDER BY lm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [currentUserId, limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET messages from one thread. */
router.get("/:id", authenticateToken, async function (req, res, next) {
  try {
    const otherUserId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query(
      `SELECT m.*, 
              sender.username as sender_username, 
              receiver.username as receiver_username
       FROM messages m 
       JOIN users sender ON m.sender_id = sender.id 
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2) 
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.user.id, otherUserId, limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET my messages. */
router.get("/", authenticateToken, async function (req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query(
      `SELECT m.*, 
              sender.username as sender_username, 
              receiver.username as receiver_username
       FROM messages m 
       JOIN users sender ON m.sender_id = sender.id 
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE m.receiver_id = $1 OR m.sender_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
