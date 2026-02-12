var express = require('express');
var router = express.Router();
var pool = require('../config/db');
var { authenticateToken, authorizePermission } = require('../middleware/authorize');

/* GET tags listing. */
router.get('/', authenticateToken, authorizePermission('read:canteen'), async function(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query('SELECT * FROM tags LIMIT $1 OFFSET $2', [limit, offset]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* POST new tag. */
router.post('/', authenticateToken, authorizePermission('write:canteen'), async function(req, res, next) {
  try {
    const { name } = req.body;
    const result = await pool.query('INSERT INTO tags (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;