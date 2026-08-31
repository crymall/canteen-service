var express = require("express");
var router = express.Router();
var pool = require("../config/db");
var {
  authenticateToken,
  currentIamId,
} = require("../middleware/authorize");
var {
  friendshipQuery,
  insertMessageQuery,
  markMessagesReadQuery,
  messageThreadsQuery,
  messageThreadQuery,
  myMessagesQuery,
} = require("./utils/queries/messages");
var { pageBounds } = require("./utils/general");

/* POST send a message. */
router.post("/", authenticateToken, async function (req, res, next) {
  try {
    const { receiver_id, content, recipe_id, list_id } = req.body;
    const iamId = currentIamId(req);

    const friendship = friendshipQuery(iamId, receiver_id);
    const friendCheck = await pool.query(friendship.text, friendship.values);

    if (friendCheck.rows.length === 0) {
      return res.status(403).json({ error: "You can only message friends" });
    }

    const { text, values } = insertMessageQuery({
      iamId,
      receiver_id,
      content,
      recipe_id,
      list_id,
    });
    const result = await pool.query(text, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* PUT mark messages as read/unread. */
router.put("/read", authenticateToken, async function (req, res, next) {
  try {
    const { message_ids, is_read } = req.body;

    if (!Array.isArray(message_ids) || message_ids.length === 0) {
      return res
        .status(400)
        .json({ error: "message_ids must be a non-empty array" });
    }

    const { text, values } = markMessagesReadQuery({
      iamId: currentIamId(req),
      messageIds: message_ids,
      isRead: is_read === undefined ? true : !!is_read,
    });
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET conversation threads (Inbox). */
router.get("/threads", authenticateToken, async function (req, res, next) {
  try {
    const { text, values } = messageThreadsQuery({
      iamId: currentIamId(req),
      ...pageBounds(req),
    });
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET messages from one thread. */
router.get("/:id", authenticateToken, async function (req, res, next) {
  try {
    const { text, values } = messageThreadQuery({
      iamId: currentIamId(req),
      otherUserId: req.params.id,
      ...pageBounds(req),
    });
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET my messages. */
router.get("/", authenticateToken, async function (req, res, next) {
  try {
    const { text, values } = myMessagesQuery({
      iamId: currentIamId(req),
      ...pageBounds(req),
    });
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
