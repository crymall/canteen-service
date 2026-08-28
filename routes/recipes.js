var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var pluralize = require("pluralize");
var {
  authenticateToken,
  authorizePermissions,
} = require("../middleware/authorize");

const optionalAuth = (req, res, next) => {
  if (req.cookies?.token) {
    return authenticateToken(req, res, next);
  }
  next();
};

const currentIamId = (req) => (req.user ? req.user.id.toString() : null);

// May not be renamed or removed, so a payload that drops it is rejected.
const UNGROUPED_GROUP_NAME = "Main";

const nullIfBlank = (value) => (value === "" ? null : value);

// NIST SP 811: unit symbols are unaltered in the plural — "75 cm", never "75 cms".
const UNIT_SYMBOLS = new Set([
  "cl", "dl", "fl oz", "g", "gal", "kg", "l", "lb",
  "mg", "ml", "oz", "pt", "qt", "tbsp", "tsp",
]);

// Not units but adjectives describing the ingredient, so the ingredient is what
// gets counted: "3 large Eggs", not "3 larges Egg".
const SIZE_DESCRIPTORS = new Set([
  "small", "medium", "large", "extra large", "jumbo",
]);

const unitKey = (unit) =>
  typeof unit === "string" ? unit.trim().toLowerCase() : null;

// Mirrors the singular normalization POST /ingredients applies to names.
const canonicalUnit = (unit) => {
  const trimmed = typeof unit === "string" ? unit.trim() : unit;
  const value = nullIfBlank(trimmed) ?? null;
  if (!value) return null;
  const key = unitKey(value);
  if (UNIT_SYMBOLS.has(key) || SIZE_DESCRIPTORS.has(key)) return value;
  return pluralize.singular(value);
};

const sumMinutes = (...values) =>
  values.reduce((total, value) => total + (parseInt(value) || 0), 0);

const recipeProjection = (viewerParam) => `
  r.*,
  CASE
    WHEN u.id IS NULL THEN NULL
    ELSE json_build_object('id', u.id, 'username', u.username)
  END AS author,
  (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', rig.id,
        'name', rig.name,
        'position', rig.position,
        'ingredients', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', ri.id,
              'ingredient_id', i.id,
              'name', i.name,
              'quantity', ri.quantity,
              'unit', ri.unit,
              'notes', ri.notes,
              'position', ri.position
            ) ORDER BY ri.position ASC
          ), '[]')
          FROM recipe_ingredients ri
          JOIN ingredients i ON ri.ingredient_id = i.id
          WHERE ri.group_id = rig.id
        )
      ) ORDER BY rig.position ASC
    ), '[]')
    FROM recipe_ingredient_groups rig
    WHERE rig.recipe_id = r.id
  ) AS ingredient_groups,
  (
    SELECT COALESCE(json_agg(json_build_object(
      'id', t.id,
      'name', t.name
    )), '[]')
    FROM recipe_tags rt
    JOIN tags t ON rt.tag_id = t.id
    WHERE rt.recipe_id = r.id
  ) AS tags,
  EXISTS (
    SELECT 1 FROM recipe_likes rl
    WHERE rl.recipe_id = r.id
      AND rl.user_id = (SELECT id FROM users WHERE iam_id = $${viewerParam})
  ) AS liked_by_current_user
`;

const selectRecipeGraph = async (executor, recipeId, viewerIamId) => {
  const result = await executor.query(
    `SELECT ${recipeProjection(2)}
     FROM recipes r
     LEFT JOIN users u ON r.author_id = u.id
     WHERE r.id = $1`,
    [recipeId, viewerIamId],
  );
  return result.rows[0] || null;
};

// Pluralization is presentation, so it is exposed alongside the stored values
// rather than replacing them.
const formatRecipe = (recipe) => {
  if (!recipe.ingredient_groups) return recipe;
  const formattedGroups = recipe.ingredient_groups.map((group) => {
    const formattedIngredients = group.ingredients.map((ing) => {
      let displayName = ing.name;
      let displayUnit = ing.unit;
      const key = unitKey(ing.unit);

      if (ing.quantity && ing.quantity > 1) {
        if (!ing.unit || SIZE_DESCRIPTORS.has(key)) {
          displayName = pluralize(ing.name);
        } else if (!UNIT_SYMBOLS.has(key)) {
          displayUnit = pluralize(ing.unit);
        }
      }
      return {
        ...ing,
        display_name: displayName,
        display_unit: displayUnit,
      };
    });
    return { ...group, ingredients: formattedIngredients };
  });
  return { ...recipe, ingredient_groups: formattedGroups };
};

const groupName = (group) => group?.name || UNGROUPED_GROUP_NAME;

const recipePayloadError = ({ title, instructions, tags, ingredient_groups }) => {
  if (typeof title !== "string" || title.trim() === "") {
    return "title is required";
  }

  if (typeof instructions !== "string" || instructions.trim() === "") {
    return "instructions are required";
  }

  if (tags !== undefined && !Array.isArray(tags)) {
    return "tags must be an array of tag ids";
  }

  if (ingredient_groups === undefined) return null;
  if (!Array.isArray(ingredient_groups)) {
    return "ingredient_groups must be an array";
  }

  const seenGroupNames = new Set();
  for (const group of ingredient_groups) {
    const name = groupName(group);
    if (seenGroupNames.has(name)) {
      return `Ingredient groups must have distinct names, but "${name}" is used more than once`;
    }
    seenGroupNames.add(name);

    if (group?.ingredients === undefined) continue;
    if (!Array.isArray(group.ingredients)) {
      return `Ingredients for group "${name}" must be an array`;
    }

    const seenIngredientIds = new Set();
    for (const ingredient of group.ingredients) {
      if (seenIngredientIds.has(ingredient?.id)) {
        return `Group "${name}" lists the same ingredient more than once`;
      }
      seenIngredientIds.add(ingredient?.id);
    }
  }

  return null;
};

const insertRecipeTags = async (client, recipeId, tags) => {
  if (!Array.isArray(tags) || tags.length === 0) return;
  await client.query(
    "INSERT INTO recipe_tags (recipe_id, tag_id) SELECT $1, unnest($2::int[])",
    [recipeId, tags],
  );
};

const insertIngredientGroups = async (client, recipeId, ingredientGroups) => {
  if (!Array.isArray(ingredientGroups) || ingredientGroups.length === 0) return;

  const groupRes = await client.query(
    `INSERT INTO recipe_ingredient_groups (recipe_id, name, position)
     SELECT $1, name, ordinality - 1
     FROM unnest($2::varchar[]) WITH ORDINALITY AS g(name, ordinality)
     RETURNING id, position`,
    [recipeId, ingredientGroups.map(groupName)],
  );

  const groupIdByPosition = new Map(
    groupRes.rows.map((row) => [row.position, row.id]),
  );

  const groupIds = [];
  const ingredientIds = [];
  const quantities = [];
  const units = [];
  const notes = [];
  const positions = [];

  ingredientGroups.forEach((group, groupPosition) => {
    if (!Array.isArray(group.ingredients)) return;
    group.ingredients.forEach((ing, ingredientPosition) => {
      groupIds.push(groupIdByPosition.get(groupPosition));
      ingredientIds.push(ing.id);
      quantities.push(nullIfBlank(ing.quantity));
      units.push(canonicalUnit(ing.unit));
      notes.push(nullIfBlank(ing.notes) ?? null);
      positions.push(ingredientPosition);
    });
  });

  if (groupIds.length === 0) return;

  await client.query(
    `INSERT INTO recipe_ingredients (group_id, ingredient_id, quantity, unit, notes, position)
     SELECT * FROM unnest($1::int[], $2::int[], $3::numeric[], $4::varchar[], $5::varchar[], $6::int[])`,
    [groupIds, ingredientIds, quantities, units, notes, positions],
  );
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

    const payloadError = recipePayloadError(req.body);
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

      if (ingredient_groups !== undefined) {
        const existing = await client.query(
          "SELECT 1 FROM recipe_ingredient_groups WHERE recipe_id = $1 AND name = $2",
          [id, UNGROUPED_GROUP_NAME],
        );
        const keepsUngrouped = ingredient_groups.some(
          (group) => groupName(group) === UNGROUPED_GROUP_NAME,
        );
        if (existing.rows.length > 0 && !keepsUngrouped) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: `The "${UNGROUPED_GROUP_NAME}" ingredient group cannot be renamed or removed`,
          });
        }
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

    const payloadError = recipePayloadError(req.body);
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
