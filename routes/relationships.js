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
var { numericParam } = require("./utils/validation/params");
var { pageBounds } = require("./utils/general");

router.param("id", numericParam("id"));

/* POST follow a user. */
router.post("/:id", authenticateToken, async function (req, res, next) {
  try {
    const followingId = req.params.id;
    const followerId = currentIamId(req);

    if (followingId === followerId) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    await pool.query(insertFollowQuery(followerId, followingId));
    res.status(201).json({ message: "Followed successfully" });
  } catch (err) {
    next(err);
  }
});

/* DELETE unfollow a user. */
router.delete("/:id", authenticateToken, async function (req, res, next) {
  try {
    await pool.query(deleteFollowQuery( currentIamId(req), req.params.id, ));
    res.json({ message: "Unfollowed successfully" });
  } catch (err) {
    next(err);
  }
});

/* GET relationship counts. */
router.get("/:id/counts", async function (req, res, next) {
  try {
    const result = await pool.query(relationshipCountsQuery(req.params.id));
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* GET followers. */
router.get("/:id/followers", async function (req, res, next) {
  try {
    const followers = followersQuery({
      userId: req.params.id,
      followerId: req.query.id,
      ...pageBounds(req),
    });
    const result = await pool.query(followers);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET following. */
router.get("/:id/following", async function (req, res, next) {
  try {
    const following = followingQuery({
      userId: req.params.id,
      ...pageBounds(req),
    });
    const result = await pool.query(following);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET friends (mutual follows). */
router.get("/:id/friends", async function (req, res, next) {
  try {
    const friends = friendsQuery({
      userId: req.params.id,
      usernameSearch: req.query.query,
      ...pageBounds(req),
    });
    const result = await pool.query(friends);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
