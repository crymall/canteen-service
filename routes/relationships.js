var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var {
  authenticateToken,
  currentIamId,
} = require("../middleware/authorize");
var {
  insertFollowQuery,
  deleteFollowQuery,
  relationshipCountsQuery,
  followersQuery,
  followingQuery,
  friendsQuery,
} = require("./utils/queries/relationships");
var { pageBounds } = require("./utils/general");

/* POST follow a user. */
router.post("/:id", authenticateToken, async function (req, res, next) {
  try {
    const followingId = req.params.id;
    const followerId = currentIamId(req);

    if (followingId === followerId) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    const { text, values } = insertFollowQuery(followerId, followingId);
    await pool.query(text, values);
    res.status(201).json({ message: "Followed successfully" });
  } catch (err) {
    next(err);
  }
});

/* DELETE unfollow a user. */
router.delete("/:id", authenticateToken, async function (req, res, next) {
  try {
    const { text, values } = deleteFollowQuery(
      currentIamId(req),
      req.params.id,
    );
    await pool.query(text, values);
    res.json({ message: "Unfollowed successfully" });
  } catch (err) {
    next(err);
  }
});

/* GET relationship counts. */
router.get("/:id/counts", async function (req, res, next) {
  try {
    const { text, values } = relationshipCountsQuery(req.params.id);
    const result = await pool.query(text, values);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* GET followers. */
router.get("/:id/followers", async function (req, res, next) {
  try {
    const { text, values } = followersQuery({
      userId: req.params.id,
      followerId: req.query.id,
      ...pageBounds(req),
    });
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET following. */
router.get("/:id/following", async function (req, res, next) {
  try {
    const { text, values } = followingQuery({
      userId: req.params.id,
      ...pageBounds(req),
    });
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET friends (mutual follows). */
router.get("/:id/friends", async function (req, res, next) {
  try {
    const { text, values } = friendsQuery({
      userId: req.params.id,
      usernameSearch: req.query.query,
      ...pageBounds(req),
    });
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
