var express = require('express');
var router = express.Router();
var pool = require('../config/db');

/* GET lists listing. */
router.get('/', async function(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query('SELECT * FROM lists LIMIT $1 OFFSET $2', [limit, offset]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET lists for a specific user. */
router.get('/user/:userId', async function(req, res, next) {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query('SELECT * FROM lists WHERE user_id = $1 LIMIT $2 OFFSET $3', [userId, limit, offset]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET single list. */
router.get('/:id', async function(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM lists WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* DELETE list. */
router.delete('/:id', async function(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM lists WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }
    res.json({ message: 'List deleted successfully', list: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/* POST new list. */
router.post('/', async function(req, res, next) {
  try {
    const { user_id, name } = req.body;
    const result = await pool.query('INSERT INTO lists (user_id, name) VALUES ($1, $2) RETURNING *', [user_id, name]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* GET recipes in list. */
router.get('/:id/recipes', async function(req, res, next) {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query(`
      SELECT r.* 
      FROM recipes r
      JOIN list_recipes lr ON r.id = lr.recipe_id
      WHERE lr.list_id = $1
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* POST add recipe to list. */
router.post('/:id/recipes', async function(req, res, next) {
  try {
    const { id } = req.params;
    const { recipe_id } = req.body;
    const result = await pool.query('INSERT INTO list_recipes (list_id, recipe_id) VALUES ($1, $2) RETURNING *', [id, recipe_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;