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
    const ingredientsPage = ingredientsPageQuery({
      name: req.query.name,
      ...pageBounds(req),
    });
    const result = await pool.query(ingredientsPage);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* POST new ingredient. */
router.post(
  "/",
  authenticateToken,
  authorizePermissions("write:data"),
  async function (req, res, next) {
    try {
      const name = canonicalIngredientName(req.body.name);

      let result = await pool.query(insertIngredientQuery(name));

      if (result.rows.length === 0) {
        result = await pool.query(ingredientByNameQuery(name));
      }
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
