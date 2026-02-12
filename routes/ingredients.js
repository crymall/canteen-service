var express = require('express');
var router = express.Router();
var pool = require('../config/db');

/* GET ingredients listing. */
router.get('/', async function(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query('SELECT * FROM ingredients LIMIT $1 OFFSET $2', [limit, offset]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* POST new ingredient. */
router.post('/', async function(req, res, next) {
  try {
    const { name } = req.body;
    const result = await pool.query('INSERT INTO ingredients (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;