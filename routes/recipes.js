var express = require('express');
var router = express.Router();
var pool = require('../config/db');

/* GET recipes listing. */
router.get('/', async function(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query('SELECT * FROM recipes LIMIT $1 OFFSET $2', [limit, offset]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET single recipe. */
router.get('/:id', async function(req, res, next) {
  try {
    const { id } = req.params;
    const query = `
      SELECT
        r.*,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', i.id,
            'name', i.name,
            'quantity', ri.quantity,
            'unit', ri.unit,
            'notes', ri.notes
          )), '[]')
          FROM recipe_ingredients ri
          JOIN ingredients i ON ri.ingredient_id = i.id
          WHERE ri.recipe_id = r.id
        ) AS ingredients,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', t.id,
            'name', t.name
          )), '[]')
          FROM recipe_tags rt
          JOIN tags t ON rt.tag_id = t.id
          WHERE rt.recipe_id = r.id
        ) AS tags,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'user_id', rl.user_id,
            'created_at', rl.created_at
          )), '[]')
          FROM recipe_likes rl
          WHERE rl.recipe_id = r.id
        ) AS likes
      FROM recipes r
      WHERE r.id = $1
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* POST new recipe. */
router.post('/', async function(req, res, next) {
  try {
    const { author_id, title, description, instructions, prep_time_minutes, cook_time_minutes, servings } = req.body;
    const result = await pool.query(
      'INSERT INTO recipes (author_id, title, description, instructions, prep_time_minutes, cook_time_minutes, servings) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [author_id, title, description, instructions, prep_time_minutes, cook_time_minutes, servings]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* POST like recipe. */
router.post('/:id/likes', async function(req, res, next) {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    const result = await pool.query('INSERT INTO recipe_likes (user_id, recipe_id) VALUES ($1, $2) RETURNING *', [user_id, id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;