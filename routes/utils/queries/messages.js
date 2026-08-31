const CURRENT_USER_ID_FROM_PARAM_1 = "(SELECT id FROM users WHERE iam_id = $1)";

const friendshipQuery = (iamId, otherUserId) => ({
  text: `SELECT 1 FROM follows f1 
       JOIN follows f2 ON f1.following_id = f2.follower_id 
       WHERE f1.follower_id = ${CURRENT_USER_ID_FROM_PARAM_1} AND f1.following_id = $2 AND f2.following_id = ${CURRENT_USER_ID_FROM_PARAM_1}`,
  values: [iamId, otherUserId],
});

const insertMessageQuery = ({
  iamId,
  receiver_id,
  content,
  recipe_id,
  list_id,
}) => ({
  text: `INSERT INTO messages (sender_id, receiver_id, content, recipe_id, list_id) 
       SELECT id, $2, $3, $4, $5 FROM users WHERE iam_id = $1 
       RETURNING *`,
  values: [iamId, receiver_id, content, recipe_id, list_id],
});

const markMessagesReadQuery = ({ iamId, messageIds, isRead }) => ({
  text: "UPDATE messages SET is_read = $1 WHERE id = ANY($2::bigint[]) AND receiver_id = (SELECT id FROM users WHERE iam_id = $3) RETURNING *",
  values: [isRead, messageIds, iamId],
});

const messageThreadsQuery = ({ iamId, limit, offset }) => ({
  text: `WITH last_messages AS (
         SELECT DISTINCT ON (
           CASE WHEN sender_id = ${CURRENT_USER_ID_FROM_PARAM_1} THEN receiver_id ELSE sender_id END
         )
         m.*,
         CASE WHEN sender_id = ${CURRENT_USER_ID_FROM_PARAM_1} THEN receiver_id ELSE sender_id END as other_user_id
         FROM messages m
         WHERE sender_id = ${CURRENT_USER_ID_FROM_PARAM_1} OR receiver_id = ${CURRENT_USER_ID_FROM_PARAM_1}
         ORDER BY 
           CASE WHEN sender_id = ${CURRENT_USER_ID_FROM_PARAM_1} THEN receiver_id ELSE sender_id END,
           created_at DESC
       )
       SELECT lm.*, u.username as other_username
       FROM last_messages lm
       JOIN users u ON lm.other_user_id = u.id
       ORDER BY lm.created_at DESC
       LIMIT $2 OFFSET $3`,
  values: [iamId, limit, offset],
});

const messageThreadQuery = ({ iamId, otherUserId, limit, offset }) => ({
  text: `SELECT m.*, 
              sender.username as sender_username, 
              receiver.username as receiver_username
       FROM messages m 
       JOIN users sender ON m.sender_id = sender.id 
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE (m.sender_id = ${CURRENT_USER_ID_FROM_PARAM_1} AND m.receiver_id = $2) 
          OR (m.sender_id = $2 AND m.receiver_id = ${CURRENT_USER_ID_FROM_PARAM_1})
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
  values: [iamId, otherUserId, limit, offset],
});

const myMessagesQuery = ({ iamId, limit, offset }) => ({
  text: `SELECT m.*, 
              sender.username as sender_username, 
              receiver.username as receiver_username
       FROM messages m 
       JOIN users sender ON m.sender_id = sender.id 
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE m.receiver_id = ${CURRENT_USER_ID_FROM_PARAM_1} OR m.sender_id = ${CURRENT_USER_ID_FROM_PARAM_1}
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
  values: [iamId, limit, offset],
});

module.exports = {
  friendshipQuery,
  insertMessageQuery,
  markMessagesReadQuery,
  messageThreadsQuery,
  messageThreadQuery,
  myMessagesQuery,
};
