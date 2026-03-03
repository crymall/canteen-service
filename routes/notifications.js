var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var { authenticateToken } = require("../middleware/authorize");

/* GET notifications listing. */
router.get("/", authenticateToken, async function (req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;

    const query = `
      (
        SELECT 
          'message' AS type,
          m.id::text AS id,
          m.sender_id AS actor_id,
          u.username AS actor_username,
          m.created_at,
          json_build_object(
            'content', m.content,
            'recipe_id', m.recipe_id,
            'list_id', m.list_id
          ) AS payload
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.receiver_id = $1
      )
      UNION ALL
      (
        SELECT 
          'follow' AS type,
          CONCAT('follow_', f.follower_id) AS id,
          f.follower_id AS actor_id,
          u.username AS actor_username,
          f.created_at,
          '{}'::json AS payload
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        WHERE f.following_id = $1
      )
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [req.user.id, limit, offset]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;