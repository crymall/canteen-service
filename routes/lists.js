var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var {
  authenticateToken,
  authorizePermissions,
} = require("../middleware/authorize");

/* GET lists listing. */
router.get("/", async function (req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const { name, sort, order } = req.query;

    let query = "SELECT * FROM lists";
    const params = [];
    let paramCount = 1;

    if (name) {
      query += ` WHERE name ILIKE $${paramCount}`;
      params.push(`%${name}%`);
      paramCount++;
    }

    const validSorts = ["created_at", "updated_at"];
    const sortBy = validSorts.includes(sort) ? sort : "created_at";
    const validOrders = ["ASC", "DESC"];
    const sortOrder = validOrders.includes((order || "").toUpperCase())
      ? (order || "").toUpperCase()
      : "DESC";

    query += ` ORDER BY ${sortBy} ${sortOrder}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET lists for a specific user. */
router.get("/user/:userId", async function (req, res, next) {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const { name, sort, order } = req.query;

    let query = "SELECT * FROM lists WHERE user_id = $1";
    const params = [userId];
    let paramCount = 2;

    if (name) {
      query += ` AND name ILIKE $${paramCount}`;
      params.push(`%${name}%`);
      paramCount++;
    }

    const validSorts = ["created_at", "updated_at"];
    const sortBy = validSorts.includes(sort) ? sort : "created_at";
    const validOrders = ["ASC", "DESC"];
    const sortOrder = validOrders.includes((order || "").toUpperCase())
      ? (order || "").toUpperCase()
      : "DESC";

    query += ` ORDER BY ${sortBy} ${sortOrder}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET single list. */
router.get("/:id", async function (req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM lists WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "List not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* DELETE list. */
router.delete(
  "/:id",
  authenticateToken,
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        "DELETE FROM lists WHERE id = $1 AND user_id = (SELECT id FROM users WHERE iam_id = $2) RETURNING *",
        [id, req.user.id.toString()],
      );
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "List not found or unauthorized" });
      }
      res.json({ message: "List deleted successfully", list: result.rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

/* POST new list. */
router.post(
  "/",
  authenticateToken,
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    try {
      const { name } = req.body;
      const result = await pool.query(
        `INSERT INTO lists (user_id, name)
         SELECT id, $2 FROM users WHERE iam_id = $1
         RETURNING *`,
        [req.user.id.toString(), name],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

/* GET recipes in list. */
router.get("/:id/recipes", async function (req, res, next) {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query(
      `
      SELECT r.* 
      FROM recipes r
      JOIN list_recipes lr ON r.id = lr.recipe_id
      WHERE lr.list_id = $1
      LIMIT $2 OFFSET $3
    `,
      [id, limit, offset],
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* POST add recipe to list. */
router.post(
  "/:id/recipes",
  authenticateToken,
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    try {
      const { id } = req.params;
      const { recipe_id } = req.body;
      const result = await pool.query(
        `INSERT INTO list_recipes (list_id, recipe_id)
       SELECT $1, $2
       WHERE EXISTS (SELECT 1 FROM lists WHERE id = $1 AND user_id = (SELECT id FROM users WHERE iam_id = $3))
       RETURNING *`,
        [id, recipe_id, req.user.id.toString()],
      );
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "List not found or unauthorized" });
      }
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "Recipe already in list" });
      }
      next(err);
    }
  },
);

/* DELETE remove recipe from list. */
router.delete(
  "/:id/recipes/:recipeId",
  authenticateToken,
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    try {
      const { id, recipeId } = req.params;
      const result = await pool.query(
        "DELETE FROM list_recipes lr USING lists l WHERE lr.list_id = l.id AND lr.list_id = $1 AND lr.recipe_id = $2 AND l.user_id = (SELECT id FROM users WHERE iam_id = $3) RETURNING lr.*",
        [id, recipeId, req.user.id.toString()],
      );
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Recipe not found in list or unauthorized" });
      }
      res.json({ message: "Recipe removed from list" });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
