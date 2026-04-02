var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var { authenticateToken } = require("../middleware/authorize");

/* POST follow a user. */
router.post("/:id", authenticateToken, async function (req, res, next) {
  try {
    const followingId = req.params.id;
    const followerId = req.user.id.toString();

    if (followingId === followerId) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    await pool.query(
      `INSERT INTO follows (follower_id, following_id) 
       SELECT id, $2 FROM users WHERE iam_id = $1 ON CONFLICT DO NOTHING`,
      [followerId, followingId]
    );
    res.status(201).json({ message: "Followed successfully" });
  } catch (err) {
    next(err);
  }
});

/* DELETE unfollow a user. */
router.delete("/:id", authenticateToken, async function (req, res, next) {
  try {
    const followingId = req.params.id;
    const followerId = req.user.id.toString();
    await pool.query(
      "DELETE FROM follows WHERE follower_id = (SELECT id FROM users WHERE iam_id = $1) AND following_id = $2",
      [followerId, followingId]
    );
    res.json({ message: "Unfollowed successfully" });
  } catch (err) {
    next(err);
  }
});

/* GET relationship counts. */
router.get("/:id/counts", authenticateToken, async function (req, res, next) {
  try {
    const result = await pool.query(
      `SELECT 
        (SELECT COUNT(*)::int FROM follows WHERE following_id = $1) as followers,
        (SELECT COUNT(*)::int FROM follows WHERE follower_id = $1) as following`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* GET followers. */
router.get("/:id/followers", authenticateToken, async function (req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const searchId = req.query.id;

    let queryStr = "SELECT u.id, u.username FROM follows f JOIN users u ON f.follower_id = u.id WHERE f.following_id = $1";
    const params = [req.params.id];

    if (searchId) {
      params.push(searchId);
      queryStr += ` AND u.id = $${params.length}`;
    }

    queryStr += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(queryStr, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET following. */
router.get("/:id/following", authenticateToken, async function (req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query(
      "SELECT u.id, u.username FROM follows f JOIN users u ON f.following_id = u.id WHERE f.follower_id = $1 LIMIT $2 OFFSET $3",
      [req.params.id, limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET friends (mutual follows). */
router.get("/:id/friends", authenticateToken, async function (req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const searchQuery = req.query.query;

    let queryStr = "SELECT u.id, u.username FROM users u JOIN follows f1 ON u.id = f1.following_id JOIN follows f2 ON u.id = f2.follower_id WHERE f1.follower_id = $1 AND f2.following_id = $1";
    const params = [req.params.id];

    if (searchQuery) {
      params.push(`%${searchQuery}%`);
      queryStr += ` AND u.username ILIKE $${params.length}`;
    }

    queryStr += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(queryStr, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
