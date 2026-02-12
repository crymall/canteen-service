var express = require('express');
var router = express.Router();
var pool = require('../config/db');
var { authenticateToken, authorizePermission, authenticateApiKey } = require('../middleware/authorize');

/* GET users listing. */
router.get('/', authenticateToken, authorizePermission('read:canteen'), async function(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query('SELECT * FROM users LIMIT $1 OFFSET $2', [limit, offset]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticateToken, authorizePermission('read:canteen'), async function(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* POST new user. */
router.post('/', authenticateApiKey, async function(req, res, next) {
  try {
    const { username, iam_id } = req.body;
    const result = await pool.query('INSERT INTO users (username, iam_id) VALUES ($1, $2) RETURNING *', [username, iam_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
