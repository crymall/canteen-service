var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var {
  authenticateToken,
  authorizePermissions,
} = require("../middleware/authorize");
var { tagsPageQuery, insertTagQuery } = require("./utils/queries/tags");
var { pageBounds } = require("./utils/general");

/* GET tags listing. */
router.get("/", async function (req, res, next) {
  try {
    const { text, values } = tagsPageQuery(pageBounds(req));
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* POST new tag. */
router.post(
  "/",
  authenticateToken,
  authorizePermissions(["write:data"]),
  async function (req, res, next) {
    try {
      const { text, values } = insertTagQuery(req.body.name);
      const result = await pool.query(text, values);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
