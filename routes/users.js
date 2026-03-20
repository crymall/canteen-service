var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var {
  authenticateToken,
  authorizePermissions,
  authenticateApiKey,
} = require("../middleware/authorize");

/* GET users listing. */
router.get("/", async function (req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query("SELECT * FROM users LIMIT $1 OFFSET $2", [
      limit,
      offset,
    ]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async function (req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* POST new user. */
router.post("/", authenticateApiKey, async function (req, res, next) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { iam_id, username } = req.body;
    const result = await client.query(
      "INSERT INTO users (iam_id, username) VALUES ($1, $2) RETURNING *",
      [iam_id, username],
    );
    const user = result.rows[0];

    await client.query("INSERT INTO lists (user_id, name) VALUES ($1, $2)", [
      user.id,
      "Favorites",
    ]);

    await client.query("COMMIT");
    res.status(201).json(user);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
