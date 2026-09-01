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
    const result = await pool.query(tagsPageQuery(pageBounds(req)));
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* POST new tag. */
router.post(
  "/",
  authenticateToken,
  authorizePermissions("write:data"),
  async function (req, res, next) {
    try {
      const result = await pool.query(insertTagQuery(req.body.name));
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
