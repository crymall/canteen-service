var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var {
  authenticateToken,
  authorizePermissions,
} = require("../middleware/authorize");
var {
  optionalAuth,
  currentIamId,
  nullIfBlank,
  sumMinutes,
  CREATE,
  UPDATE,
  recipeProjection,
  selectRecipeGraph,
  formatRecipe,
  recipePayloadError,
  insertRecipeTags,
  insertIngredientGroups,
} = require("./utils/recipes");

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
        SELECT rig.recipe_id
        FROM recipe_ingredients ri
        JOIN recipe_ingredient_groups rig ON ri.group_id = rig.id
        WHERE ri.ingredient_id = ANY($${paramCount}::int[])
        GROUP BY rig.recipe_id
        HAVING COUNT(DISTINCT ri.ingredient_id) = array_length($${paramCount}::int[], 1)
      )`;
      params.push(ingredients);
      paramCount++;
    }

    if (feed) {
      if (!req.user) {
        return res
          .status(401)
          .json({ error: "Authentication required for feed" });
      }
      if (feed === "following") {
        whereClause += ` AND r.author_id IN (
          SELECT following_id FROM follows WHERE follower_id = (SELECT id FROM users WHERE iam_id = $${paramCount})
        )`;
        params.push(req.user.id.toString());
        paramCount++;
      } else if (feed === "friends") {
        whereClause += ` AND r.author_id IN (
          SELECT f1.following_id
          FROM follows f1
          JOIN follows f2 ON f1.following_id = f2.follower_id
          WHERE f1.follower_id = (SELECT id FROM users WHERE iam_id = $${paramCount}) AND f2.following_id = (SELECT id FROM users WHERE iam_id = $${paramCount})
        )`;
        params.push(req.user.id.toString());
        paramCount++;
      }
    }

    params.push(limit);
    const limitParam = paramCount++;
    params.push(offset);
    const offsetParam = paramCount++;
    params.push(currentIamId(req));
    const viewerParam = paramCount++;

    const query = `
      WITH page AS (
        SELECT r.id
        FROM recipes r
        WHERE 1=1 ${whereClause}
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT $${limitParam} OFFSET $${offsetParam}
      )
      SELECT ${recipeProjection(viewerParam)}
      FROM page
      JOIN recipes r ON r.id = page.id
      LEFT JOIN users u ON r.author_id = u.id
      ORDER BY r.created_at DESC, r.id DESC
    `;
    const result = await pool.query(query, params);
    res.json(result.rows.map(formatRecipe));
  } catch (err) {
    next(err);
  }
});

/* GET recipes sorted by likes. */
router.get("/popular", optionalAuth, async function (req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;
    const query = `
      WITH page AS (
        SELECT r.id
        FROM recipes r
        ORDER BY r.like_count DESC, r.id DESC
        LIMIT $1 OFFSET $2
      )
      SELECT ${recipeProjection(3)}
      FROM page
      JOIN recipes r ON r.id = page.id
      LEFT JOIN users u ON r.author_id = u.id
      ORDER BY r.like_count DESC, r.id DESC
    `;
    const result = await pool.query(query, [limit, offset, currentIamId(req)]);
    res.json(result.rows.map(formatRecipe));
  } catch (err) {
    next(err);
  }
});

/* GET recipes by user. */
router.get("/user/:userId", optionalAuth, async function (req, res, next) {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 50);
    const offset = parseInt(req.query.offset) || 0;

    const query = `
      WITH page AS (
        SELECT r.id
        FROM recipes r
        WHERE r.author_id = $1
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT $2 OFFSET $3
      )
      SELECT ${recipeProjection(4)}
      FROM page
      JOIN recipes r ON r.id = page.id
      LEFT JOIN users u ON r.author_id = u.id
      ORDER BY r.created_at DESC, r.id DESC
    `;
    const result = await pool.query(query, [
      userId,
      limit,
      offset,
      currentIamId(req),
    ]);
    res.json(result.rows.map(formatRecipe));
  } catch (err) {
    next(err);
  }
});

/* GET single recipe. */
router.get("/:id", optionalAuth, async function (req, res, next) {
  try {
    const recipe = await selectRecipeGraph(
      pool,
      req.params.id,
      currentIamId(req),
    );
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }
    res.json(formatRecipe(recipe));
  } catch (err) {
    next(err);
  }
});

/* PUT update recipe, its tags, and its ingredient groups in one transaction. */
router.put(
  "/:id",
  authenticateToken,
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    const {
      title,
      description,
      instructions,
      prep_time_minutes,
      cook_time_minutes,
      wait_time_minutes,
      servings,
      tags,
      ingredient_groups,
    } = req.body;

    const payloadError = recipePayloadError(req.body, UPDATE);
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const { id } = req.params;
    const iamId = req.user.id.toString();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const updated = await client.query(
        `UPDATE recipes
         SET title = $1, description = $2, instructions = $3, prep_time_minutes = $4,
             cook_time_minutes = $5, wait_time_minutes = $6, total_time_minutes = $7,
             servings = $8, updated_at = CURRENT_TIMESTAMP
         WHERE id = $9 AND author_id = (SELECT id FROM users WHERE iam_id = $10)
         RETURNING id`,
        [
          title,
          description,
          instructions,
          nullIfBlank(prep_time_minutes),
          nullIfBlank(cook_time_minutes),
          nullIfBlank(wait_time_minutes),
          sumMinutes(prep_time_minutes, cook_time_minutes, wait_time_minutes),
          nullIfBlank(servings),
          id,
          iamId,
        ],
      );

      if (updated.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: "Recipe not found or unauthorized" });
      }

      if (tags !== undefined) {
        await client.query("DELETE FROM recipe_tags WHERE recipe_id = $1", [id]);
        await insertRecipeTags(client, id, tags);
      }

      if (ingredient_groups !== undefined) {
        await client.query(
          "DELETE FROM recipe_ingredient_groups WHERE recipe_id = $1",
          [id],
        );
        await insertIngredientGroups(client, id, ingredient_groups);
      }

      const recipe = await selectRecipeGraph(client, id, iamId);

      await client.query("COMMIT");
      res.json(formatRecipe(recipe));
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  },
);

/* POST new recipe. */
router.post(
  "/",
  authenticateToken,
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    const {
      title,
      description,
      instructions,
      prep_time_minutes,
      cook_time_minutes,
      wait_time_minutes,
      servings,
      tags,
      ingredient_groups,
    } = req.body;

    const payloadError = recipePayloadError(req.body, CREATE);
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO recipes (author_id, title, description, instructions, prep_time_minutes, cook_time_minutes, wait_time_minutes, total_time_minutes, servings)
         SELECT id, $2, $3, $4, $5, $6, $7, $8, $9
         FROM users WHERE iam_id = $1
         RETURNING *`,
        [
          req.user.id.toString(),
          title,
          description,
          instructions,
          nullIfBlank(prep_time_minutes),
          nullIfBlank(cook_time_minutes),
          nullIfBlank(wait_time_minutes),
          sumMinutes(prep_time_minutes, cook_time_minutes, wait_time_minutes),
          nullIfBlank(servings),
        ],
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({ error: "User does not exist in local database" });
      }

      const recipe = result.rows[0];

      await insertRecipeTags(client, recipe.id, tags);
      await insertIngredientGroups(client, recipe.id, ingredient_groups);

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
        "DELETE FROM recipes WHERE id = $1 AND author_id = (SELECT id FROM users WHERE iam_id = $2) RETURNING *",
        [id, req.user.id.toString()],
      );
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Recipe not found or unauthorized" });
      }
      res.json({
        message: "Recipe deleted successfully",
        recipe: result.rows[0],
      });
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
        `INSERT INTO recipe_likes (user_id, recipe_id)
         SELECT id, $2 FROM users WHERE iam_id = $1
         ON CONFLICT (user_id, recipe_id) DO UPDATE SET recipe_id = EXCLUDED.recipe_id
         RETURNING *`,
        [req.user.id.toString(), id],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User or Recipe not found" });
      }
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
        "DELETE FROM recipe_likes WHERE recipe_id = $1 AND user_id = (SELECT id FROM users WHERE iam_id = $2) RETURNING *",
        [id, req.user.id.toString()],
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

module.exports = router;
