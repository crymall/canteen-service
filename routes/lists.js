var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var {
  authenticateToken,
  authorizePermissions,
  currentIamId,
} = require("../middleware/authorize");
var {
  listsPageQuery,
  listsByUserQuery,
  listByIdQuery,
  insertListQuery,
  deleteListQuery,
  listRecipesQuery,
  insertListRecipeQuery,
  deleteListRecipeQuery,
} = require("./utils/queries/lists");
var { pageBounds } = require("./utils/general");

/* GET lists listing. */
router.get("/", async function (req, res, next) {
  try {
    const { name, sort, order } = req.query;
    const listsPage = listsPageQuery({
      name,
      sort,
      order,
      ...pageBounds(req),
    });
    const result = await pool.query(listsPage);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET lists for a specific user. */
router.get("/user/:userId", async function (req, res, next) {
  try {
    const { name, sort, order } = req.query;
    const listsByUser = listsByUserQuery({
      userId: req.params.userId,
      name,
      sort,
      order,
      ...pageBounds(req),
    });
    const result = await pool.query(listsByUser);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET single list. */
router.get("/:id", async function (req, res, next) {
  try {
    const result = await pool.query(listByIdQuery(req.params.id));
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
  authorizePermissions("write:data"),
  async function (req, res, next) {
    try {
      const deleteList = deleteListQuery(
        req.params.id,
        currentIamId(req),
      );
      const result = await pool.query(deleteList);
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
  authorizePermissions("write:data"),
  async function (req, res, next) {
    try {
      const insertList = insertListQuery(
        currentIamId(req),
        req.body.name,
      );
      const result = await pool.query(insertList);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

/* GET recipes in list. */
router.get("/:id/recipes", async function (req, res, next) {
  try {
    const listRecipes = listRecipesQuery({
      listId: req.params.id,
      ...pageBounds(req),
    });
    const result = await pool.query(listRecipes);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* POST add recipe to list. */
router.post(
  "/:id/recipes",
  authenticateToken,
  authorizePermissions("write:data"),
  async function (req, res, next) {
    try {
      const insertListRecipe = insertListRecipeQuery(
        req.params.id,
        req.body.recipe_id,
        currentIamId(req),
      );
      const result = await pool.query(insertListRecipe);
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
  authorizePermissions("write:data"),
  async function (req, res, next) {
    try {
      const deleteListRecipe = deleteListRecipeQuery(
        req.params.id,
        req.params.recipeId,
        currentIamId(req),
      );
      const result = await pool.query(deleteListRecipe);
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
