var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var {
  authenticateToken,
  authorizePermissions,
} = require("../middleware/authorize");
var { canonicalIngredientName } = require("./utils/ingredients");
var {
  ingredientsPageQuery,
  insertIngredientQuery,
  ingredientByNameQuery,
} = require("./utils/queries/ingredients");
var { pageBounds } = require("./utils/general");

/* GET ingredients listing. */
router.get("/", async function (req, res, next) {
  try {
    const { text, values } = ingredientsPageQuery({
      name: req.query.name,
      ...pageBounds(req),
    });
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* POST new ingredient. */
router.post(
  "/",
  authenticateToken,
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    try {
      const name = canonicalIngredientName(req.body.name);

      const insert = insertIngredientQuery(name);
      let result = await pool.query(insert.text, insert.values);

      if (result.rows.length === 0) {
        const existing = ingredientByNameQuery(name);
        result = await pool.query(existing.text, existing.values);
      }
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
