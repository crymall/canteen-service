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
var { numericParam } = require("./utils/validation/params");
var {
  messagePayloadError,
  markReadPayloadError,
} = require("./utils/validation/messages");
var { pageBounds } = require("./utils/general");

router.param("id", numericParam("id"));

/* POST send a message. */
router.post("/", authenticateToken, async function (req, res, next) {
  const payloadError = messagePayloadError(req.body);
  if (payloadError) {
    return res.status(400).json({ error: payloadError });
  }

  try {
    const { receiver_id, content, recipe_id, list_id } = req.body;
    const iamId = currentIamId(req);

    const friendCheck = await pool.query(friendshipQuery(iamId, receiver_id));

    if (friendCheck.rows.length === 0) {
      return res.status(403).json({ error: "You can only message friends" });
    }

    const insertMessage = insertMessageQuery({
      iamId,
      receiver_id,
      content,
      recipe_id,
      list_id,
    });
    const result = await pool.query(insertMessage);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* PUT mark messages as read/unread. */
router.put("/read", authenticateToken, async function (req, res, next) {
  const payloadError = markReadPayloadError(req.body);
  if (payloadError) {
    return res.status(400).json({ error: payloadError });
  }

  try {
    const { message_ids, is_read } = req.body;

    const markMessagesRead = markMessagesReadQuery({
      iamId: currentIamId(req),
      messageIds: message_ids,
      isRead: is_read === undefined ? true : !!is_read,
    });
    const result = await pool.query(markMessagesRead);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET conversation threads (Inbox). */
router.get("/threads", authenticateToken, async function (req, res, next) {
  try {
    const messageThreads = messageThreadsQuery({
      iamId: currentIamId(req),
      ...pageBounds(req),
    });
    const result = await pool.query(messageThreads);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET messages from one thread. */
router.get("/:id", authenticateToken, async function (req, res, next) {
  try {
    const messageThread = messageThreadQuery({
      iamId: currentIamId(req),
      otherUserId: req.params.id,
      ...pageBounds(req),
    });
    const result = await pool.query(messageThread);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* GET my messages. */
router.get("/", authenticateToken, async function (req, res, next) {
  try {
    const myMessages = myMessagesQuery({
      iamId: currentIamId(req),
      ...pageBounds(req),
    });
    const result = await pool.query(myMessages);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
