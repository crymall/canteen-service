var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var {
  authenticateToken,
  authorizePermissions,
} = require("../middleware/authorize");

/* GET recipes listing. */
router.get(
  "/",
  authenticateToken,
  authorizePermissions(["read:canteen", "read:public"]),
  async function (req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 50);
      const offset = parseInt(req.query.offset) || 0;

      const parseIds = (input) => {
        if (!input) return [];
        if (Array.isArray(input)) return input.map(Number);
        return input.split(",").map(Number);
      };

      const tags = parseIds(req.query.tags);
      const ingredients = parseIds(req.query.ingredients);
      const { title } = req.query;

      let whereClause = "";
      let params = [];
      let paramCount = 1;

      if (title) {
        whereClause += ` AND r.title ILIKE $${paramCount}`;
        params.push(`%${title}%`);
        paramCount++;
      }

      if (tags && Array.isArray(tags) && tags.length > 0) {
        whereClause += ` AND r.id IN (
        SELECT recipe_id 
        FROM recipe_tags 
        WHERE tag_id = ANY($${paramCount}::int[]) 
        GROUP BY recipe_id 
        HAVING COUNT(DISTINCT tag_id) = array_length($${paramCount}::int[], 1)
      )`;
        params.push(tags);
        paramCount++;
      }

      if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
        whereClause += ` AND r.id IN (
        SELECT recipe_id 
        FROM recipe_ingredients 
        WHERE ingredient_id = ANY($${paramCount}::int[]) 
        GROUP BY recipe_id 
        HAVING COUNT(DISTINCT ingredient_id) = array_length($${paramCount}::int[], 1)
      )`;
        params.push(ingredients);
        paramCount++;
      }

      params.push(limit);
      const limitParam = paramCount++;
      params.push(offset);
      const offsetParam = paramCount++;

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
      WHERE 1=1 ${whereClause}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },
);

/* GET recipes sorted by likes. */
router.get(
  "/popular",
  authenticateToken,
  authorizePermissions(["read:canteen", "read:public"]),
  async function (req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 50);
      const offset = parseInt(req.query.offset) || 0;
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
        ) AS likes,
        (
          SELECT COUNT(*) FROM recipe_likes rl WHERE rl.recipe_id = r.id
        ) AS like_count
      FROM recipes r
      ORDER BY like_count DESC
      LIMIT $1 OFFSET $2
    `;
      const result = await pool.query(query, [limit, offset]);
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },
);

/* GET single recipe. */
router.get(
  "/:id",
  authenticateToken,
  authorizePermissions(["read:canteen", "read:public"]),
  async function (req, res, next) {
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
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

/* PUT update recipe. */
router.put(
  "/:id",
  authenticateToken,
  authorizePermissions(["write:canteen"]),
  async function (req, res, next) {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        instructions,
        prep_time_minutes,
        cook_time_minutes,
        servings,
      } = req.body;
      const result = await pool.query(
        "UPDATE recipes SET title = $1, description = $2, instructions = $3, prep_time_minutes = $4, cook_time_minutes = $5, servings = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 AND author_id = $8 RETURNING *",
        [
          title,
          description,
          instructions,
          prep_time_minutes,
          cook_time_minutes,
          servings,
          id,
          req.user.id,
        ],
      );
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Recipe not found or unauthorized" });
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

/* POST new recipe. */
router.post(
  "/",
  authenticateToken,
  authorizePermissions(["write:canteen"]),
  async function (req, res, next) {
    try {
      const {
        title,
        description,
        instructions,
        prep_time_minutes,
        cook_time_minutes,
        servings,
      } = req.body;
      const result = await pool.query(
        "INSERT INTO recipes (author_id, title, description, instructions, prep_time_minutes, cook_time_minutes, servings) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [
          req.user.id,
          title,
          description,
          instructions,
          prep_time_minutes,
          cook_time_minutes,
          servings,
        ],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

/* POST add ingredient to recipe. */
router.post(
  "/:id/ingredients",
  authenticateToken,
  authorizePermissions(["write:canteen"]),
  async function (req, res, next) {
    try {
      const { id } = req.params;
      const { ingredient_id, quantity, unit, notes } = req.body;
      const result = await pool.query(
        `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes)
       SELECT $1, $2, $3, $4, $5
       WHERE EXISTS (SELECT 1 FROM recipes WHERE id = $1 AND author_id = $6)
       RETURNING *`,
        [id, ingredient_id, quantity, unit, notes, req.user.id],
      );
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Recipe not found or unauthorized" });
      }
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

/* POST add tag to recipe. */
router.post(
  "/:id/tags",
  authenticateToken,
  authorizePermissions(["write:canteen"]),
  async function (req, res, next) {
    try {
      const { id } = req.params;
      const { tag_id } = req.body;
      const result = await pool.query(
        `INSERT INTO recipe_tags (recipe_id, tag_id)
       SELECT $1, $2
       WHERE EXISTS (SELECT 1 FROM recipes WHERE id = $1 AND author_id = $3)
       RETURNING *`,
        [id, tag_id, req.user.id],
      );
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Recipe not found or unauthorized" });
      }
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

/* POST like recipe. */
router.post(
  "/:id/likes",
  authenticateToken,
  authorizePermissions(["write:canteen"]),
  async function (req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        "INSERT INTO recipe_likes (user_id, recipe_id) VALUES ($1, $2) RETURNING *",
        [req.user.id, id],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

/* DELETE recipe like. */
router.delete(
  "/:id/likes",
  authenticateToken,
  authorizePermissions(["write:canteen"]),
  async function (req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        "DELETE FROM recipe_likes WHERE recipe_id = $1 AND user_id = $2 RETURNING *",
        [id, req.user.id],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Like not found" });
      }
      res.json({ message: "Like removed" });
    } catch (err) {
      next(err);
    }
  },
);

/* DELETE recipe tag. */
router.delete(
  "/:id/tags/:tagId",
  authenticateToken,
  authorizePermissions(["write:canteen"]),
  async function (req, res, next) {
    try {
      const { id, tagId } = req.params;
      const result = await pool.query(
        "DELETE FROM recipe_tags rt USING recipes r WHERE rt.recipe_id = r.id AND rt.recipe_id = $1 AND rt.tag_id = $2 AND r.author_id = $3 RETURNING rt.*",
        [id, tagId, req.user.id],
      );
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Tag not found on recipe or unauthorized" });
      }
      res.json({ message: "Tag removed from recipe" });
    } catch (err) {
      next(err);
    }
  },
);

/* DELETE recipe ingredient. */
router.delete(
  "/:id/ingredients/:ingredientId",
  authenticateToken,
  authorizePermissions(["write:canteen"]),
  async function (req, res, next) {
    try {
      const { id, ingredientId } = req.params;
      const result = await pool.query(
        "DELETE FROM recipe_ingredients ri USING recipes r WHERE ri.recipe_id = r.id AND ri.recipe_id = $1 AND ri.ingredient_id = $2 AND r.author_id = $3 RETURNING ri.*",
        [id, ingredientId, req.user.id],
      );
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Ingredient not found on recipe or unauthorized" });
      }
      res.json({ message: "Ingredient removed from recipe" });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
