var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var {
  authenticateApiKey,
  authenticateToken,
  currentIamId,
} = require("../middleware/authorize");
var {
  usersPageQuery,
  userByIamIdQuery,
  userByIdQuery,
  insertUserQuery,
  insertListForUserQuery,
  deleteUserByIamIdQuery,
} = require("./utils/queries/users");
var { pageBounds } = require("./utils/general");

const DEFAULT_LIST_NAME = "Favorites";

/* GET users listing. */
router.get("/", async function (req, res, next) {
  try {
    const { text, values } = usersPageQuery(pageBounds(req));
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET logged-in user data. */
router.get("/me", authenticateToken, async function (req, res, next) {
  try {
    const { text, values } = userByIamIdQuery(currentIamId(req));
    const result = await pool.query(text, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found in local database" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async function (req, res, next) {
  try {
    const { text, values } = userByIdQuery(req.params.id);
    const result = await pool.query(text, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* POST new user. */
router.post("/", authenticateApiKey, async function (req, res, next) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { iam_id, username } = req.body;

    const insertUser = insertUserQuery(iam_id, username);
    const result = await client.query(insertUser.text, insertUser.values);
    const user = result.rows[0];

    const insertList = insertListForUserQuery(user.id, DEFAULT_LIST_NAME);
    await client.query(insertList.text, insertList.values);

    await client.query("COMMIT");
    res.status(201).json(user);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* DELETE user sync webhook. */
router.delete(
  "/sync/:iam_id",
  authenticateApiKey,
  async function (req, res, next) {
    try {
      const { text, values } = deleteUserByIamIdQuery(req.params.iam_id);
      const result = await pool.query(text, values);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: "User deleted", user: result.rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
