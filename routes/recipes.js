var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var pluralize = require("pluralize");
var {
  authenticateToken,
  authorizePermissions,
} = require("../middleware/authorize");

const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return authenticateToken(req, res, next);
  }
  next();
};

const formatRecipe = (recipe) => {
  if (!recipe.ingredients) return recipe;
  const formattedIngredients = recipe.ingredients.map((ing) => {
    let displayName = ing.name;
    let displayUnit = ing.unit;

    if (ing.quantity && ing.quantity > 1) {
      if (ing.unit) {
        displayUnit = pluralize(ing.unit);
      } else {
        displayName = pluralize(ing.name);
      }
    }

    return {
      ...ing,
      name: displayName,
      unit: displayUnit,
    };
  });
  return { ...recipe, ingredients: formattedIngredients };
};

/* GET recipes listing. */
router.get("/", optionalAuth, async function (req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;

    const parseIds = (input) => {
      if (!input) return [];
      if (Array.isArray(input)) return input.map(Number);
      return input.split(",").map(Number);
    };

    const ids = parseIds(req.query.ids);
    const tags = parseIds(req.query.tags);
    const ingredients = parseIds(req.query.ingredients);
    const { title, feed } = req.query;

    let whereClause = "";
    let params = [];
    let paramCount = 1;

    if (title) {
      whereClause += ` AND r.title ILIKE $${paramCount}`;
      params.push(`%${title}%`);
      paramCount++;
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      whereClause += ` AND r.id = ANY($${paramCount}::bigint[])`;
      params.push(ids);
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

    if (feed) {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required for feed" });
      }
      if (feed === "following") {
        whereClause += ` AND r.author_id IN (
          SELECT following_id FROM follows WHERE follower_id = $${paramCount}
        )`;
        params.push(req.user.id);
        paramCount++;
      } else if (feed === "friends") {
        whereClause += ` AND r.author_id IN (
          SELECT f1.following_id 
          FROM follows f1 
          JOIN follows f2 ON f1.following_id = f2.follower_id 
          WHERE f1.follower_id = $${paramCount} AND f2.following_id = $${paramCount}
        )`;
        params.push(req.user.id);
        paramCount++;
      }
    }

    params.push(limit);
    const limitParam = paramCount++;
    params.push(offset);
    const offsetParam = paramCount++;

    const query = `
      SELECT
        r.*,
        json_build_object('id', u.id, 'username', u.username) AS author,
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
      JOIN users u ON r.author_id = u.id
      WHERE 1=1 ${whereClause}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;
    const result = await pool.query(query, params);
    res.json(result.rows.map(formatRecipe));
  } catch (err) {
    next(err);
  }
});

/* GET recipes sorted by likes. */
router.get("/popular", async function (req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const query = `
      SELECT
        r.*,
        json_build_object('id', u.id, 'username', u.username) AS author,
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
      JOIN users u ON r.author_id = u.id
      ORDER BY like_count DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    res.json(result.rows.map(formatRecipe));
  } catch (err) {
    next(err);
  }
});

/* GET recipes by user. */
router.get("/user/:userId", async function (req, res, next) {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;

    const query = `
      SELECT
        r.*,
        json_build_object('id', u.id, 'username', u.username) AS author,
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
      JOIN users u ON r.author_id = u.id
      WHERE r.author_id = $1
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    res.json(result.rows.map(formatRecipe));
  } catch (err) {
    next(err);
  }
});

/* GET single recipe. */
router.get("/:id", async function (req, res, next) {
  try {
    const { id } = req.params;
    const query = `
      SELECT
        r.*,
        json_build_object('id', u.id, 'username', u.username) AS author,
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
      JOIN users u ON r.author_id = u.id
      WHERE r.id = $1
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }
    res.json(formatRecipe(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

/* PUT update recipe. */
router.put(
  "/:id",
  authenticateToken,
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        instructions,
        prep_time_minutes,
        cook_time_minutes,
        wait_time_minutes,
        servings,
      } = req.body;

      const parsedPrepTime = prep_time_minutes === "" ? null : prep_time_minutes;
      const parsedCookTime = cook_time_minutes === "" ? null : cook_time_minutes;
      const parsedWaitTime = wait_time_minutes === "" ? null : wait_time_minutes;
      const parsedServings = servings === "" ? null : servings;

      const total_time_minutes =
        (parseInt(prep_time_minutes) || 0) +
        (parseInt(cook_time_minutes) || 0) +
        (parseInt(wait_time_minutes) || 0);

      const result = await pool.query(
        "UPDATE recipes SET title = $1, description = $2, instructions = $3, prep_time_minutes = $4, cook_time_minutes = $5, wait_time_minutes = $6, total_time_minutes = $7, servings = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 AND author_id = $10 RETURNING *",
        [
          title,
          description,
          instructions,
          parsedPrepTime,
          parsedCookTime,
          parsedWaitTime,
          total_time_minutes,
          parsedServings,
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
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const {
        title,
        description,
        instructions,
        prep_time_minutes,
        cook_time_minutes,
        wait_time_minutes,
        servings,
        tags,
        ingredients,
      } = req.body;

      const parsedPrepTime = prep_time_minutes === "" ? null : prep_time_minutes;
      const parsedCookTime = cook_time_minutes === "" ? null : cook_time_minutes;
      const parsedWaitTime = wait_time_minutes === "" ? null : wait_time_minutes;
      const parsedServings = servings === "" ? null : servings;

      const total_time_minutes =
        (parseInt(prep_time_minutes) || 0) +
        (parseInt(cook_time_minutes) || 0) +
        (parseInt(wait_time_minutes) || 0);

      const result = await client.query(
        "INSERT INTO recipes (author_id, title, description, instructions, prep_time_minutes, cook_time_minutes, wait_time_minutes, total_time_minutes, servings) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
        [
          req.user.id,
          title,
          description,
          instructions,
          parsedPrepTime,
          parsedCookTime,
          parsedWaitTime,
          total_time_minutes,
          parsedServings,
        ],
      );
      const recipe = result.rows[0];

      if (tags && Array.isArray(tags)) {
        for (const tagId of tags) {
          await client.query(
            "INSERT INTO recipe_tags (recipe_id, tag_id) VALUES ($1, $2)",
            [recipe.id, tagId],
          );
        }
      }

      if (ingredients && Array.isArray(ingredients)) {
        for (const ing of ingredients) {
          await client.query(
            "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes) VALUES ($1, $2, $3, $4, $5)",
            [
              recipe.id,
              ing.id,
              ing.quantity === "" ? null : ing.quantity,
              ing.unit,
              ing.notes,
            ],
          );
        }
      }

      await client.query("COMMIT");
      res.status(201).json(recipe);
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  },
);

/* DELETE recipe. */
router.delete(
  "/:id",
  authenticateToken,
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        "DELETE FROM recipes WHERE id = $1 AND author_id = $2 RETURNING *",
        [id, req.user.id],
      );
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Recipe not found or unauthorized" });
      }
      res.json({ message: "Recipe deleted successfully", recipe: result.rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

/* POST add ingredient to recipe. */
router.post(
  "/:id/ingredients",
  authenticateToken,
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    try {
      const { id } = req.params;
      const { ingredient_id, quantity, unit, notes } = req.body;
      const parsedQuantity = quantity === "" ? null : quantity;
      const result = await pool.query(
        `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes)
       SELECT $1, $2, $3, $4, $5
       WHERE EXISTS (SELECT 1 FROM recipes WHERE id = $1 AND author_id = $6)
       RETURNING *`,
        [id, ingredient_id, parsedQuantity, unit, notes, req.user.id],
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
  authorizePermissions(["write:data"]),
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
  authorizePermissions(["write:data"]),
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
  authorizePermissions(["write:data"]),
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
  authorizePermissions(["write:data"]),
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
  authorizePermissions(["write:data"]),
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
