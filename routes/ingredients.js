var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var {
  authenticateToken,
  authorizePermissions,
} = require("../middleware/authorize");

/* GET ingredients listing. */
router.get(
  "/",
  async function (req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 50);
      const offset = parseInt(req.query.offset) || 0;
      const { name } = req.query;

      let query = "SELECT * FROM ingredients";
      const params = [];
      let paramCount = 1;

      if (name) {
        query += ` WHERE name ILIKE $${paramCount}`;
        params.push(`%${name}%`);
        paramCount++;
      }

      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },
);

/* POST new ingredient. */
router.post(
  "/",
  authenticateToken,
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    try {
      const { name } = req.body;
      const result = await pool.query(
        "INSERT INTO ingredients (name) VALUES ($1) RETURNING *",
        [name],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
