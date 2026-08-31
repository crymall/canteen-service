var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var {
  authenticateToken,
  authorizePermissions,
  optionalAuth,
  currentIamId,
} = require("../middleware/authorize");
var { CREATE, UPDATE } = require("./utils/constants");
var {
  parseIdList,
  formatRecipe,
  recipePayloadError,
  insertIngredientTree,
} = require("./utils/recipes");
var {
  recipeSearchQuery,
  popularRecipesQuery,
  recipesByAuthorQuery,
  selectRecipeGraphQuery,
  insertRecipeQuery,
  updateRecipeQuery,
  deleteRecipeQuery,
  deleteRecipeTagsQuery,
  insertRecipeTagsQuery,
  deleteIngredientGroupsQuery,
  insertRecipeLikeQuery,
  deleteRecipeLikeQuery,
} = require("./utils/queries/recipes");
var { pageBounds } = require("./utils/general");

/* GET recipes listing. */
router.get("/", optionalAuth, async function (req, res, next) {
  try {
    const { title, feed } = req.query;

    if (feed && !req.user) {
      return res
        .status(401)
        .json({ error: "Authentication required for feed" });
    }

    const { text, values } = recipeSearchQuery({
      title,
      ids: parseIdList(req.query.ids),
      tags: parseIdList(req.query.tags),
      ingredients: parseIdList(req.query.ingredients),
      feed,
      viewerIamId: currentIamId(req),
      ...pageBounds(req),
    });

    const result = await pool.query(text, values);
    res.json(result.rows.map(formatRecipe));
  } catch (err) {
    next(err);
  }
});

/* GET recipes sorted by likes. */
router.get("/popular", optionalAuth, async function (req, res, next) {
  try {
    const { text, values } = popularRecipesQuery({
      viewerIamId: currentIamId(req),
      ...pageBounds(req),
    });
    const result = await pool.query(text, values);
    res.json(result.rows.map(formatRecipe));
  } catch (err) {
    next(err);
  }
});

/* GET recipes by user. */
router.get("/user/:userId", optionalAuth, async function (req, res, next) {
  try {
    const { text, values } = recipesByAuthorQuery({
      authorId: req.params.userId,
      viewerIamId: currentIamId(req),
      ...pageBounds(req),
    });
    const result = await pool.query(text, values);
    res.json(result.rows.map(formatRecipe));
  } catch (err) {
    next(err);
  }
});

/* GET single recipe. */
router.get("/:id", optionalAuth, async function (req, res, next) {
  try {
    const { text, values } = selectRecipeGraphQuery(
      req.params.id,
      currentIamId(req),
    );
    const result = await pool.query(text, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }
    res.json(formatRecipe(result.rows[0]));
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
    const payloadError = recipePayloadError(req.body, UPDATE);
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const { tags, ingredient_groups } = req.body;
    const { id } = req.params;
    const iamId = currentIamId(req);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const update = updateRecipeQuery({ ...req.body, id, iamId });
      const updated = await client.query(update.text, update.values);

      if (updated.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: "Recipe not found or unauthorized" });
      }

      if (tags !== undefined) {
        const clearTags = deleteRecipeTagsQuery(id);
        await client.query(clearTags.text, clearTags.values);

        const insertTags = insertRecipeTagsQuery(id, tags);
        if (insertTags) {
          await client.query(insertTags.text, insertTags.values);
        }
      }

      if (ingredient_groups !== undefined) {
        const clearGroups = deleteIngredientGroupsQuery(id);
        await client.query(clearGroups.text, clearGroups.values);
        await insertIngredientTree(client, id, ingredient_groups);
      }

      const graph = selectRecipeGraphQuery(id, iamId);
      const recipe = await client.query(graph.text, graph.values);

      await client.query("COMMIT");
      res.json(formatRecipe(recipe.rows[0]));
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
    const payloadError = recipePayloadError(req.body, CREATE);
    if (payloadError) {
      return res.status(400).json({ error: payloadError });
    }

    const { tags, ingredient_groups } = req.body;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const insert = insertRecipeQuery({
        ...req.body,
        iamId: currentIamId(req),
      });
      const result = await client.query(insert.text, insert.values);

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({ error: "User does not exist in local database" });
      }

      const recipe = result.rows[0];

      const insertTags = insertRecipeTagsQuery(recipe.id, tags);
      if (insertTags) {
        await client.query(insertTags.text, insertTags.values);
      }

      await insertIngredientTree(client, recipe.id, ingredient_groups);

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
      const { text, values } = deleteRecipeQuery(
        req.params.id,
        currentIamId(req),
      );
      const result = await pool.query(text, values);
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
      const { text, values } = insertRecipeLikeQuery(
        req.params.id,
        currentIamId(req),
      );
      const result = await pool.query(text, values);
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
      const { text, values } = deleteRecipeLikeQuery(
        req.params.id,
        currentIamId(req),
      );
      const result = await pool.query(text, values);
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
