var { queryParameters } = require("../general");

const insertFollowQuery = (followerIamId, followingId) => ({
  text: `INSERT INTO follows (follower_id, following_id) 
       SELECT id, $2 FROM users WHERE iam_id = $1 ON CONFLICT DO NOTHING`,
  values: [followerIamId, followingId],
});

const deleteFollowQuery = (followerIamId, followingId) => ({
  text: "DELETE FROM follows WHERE follower_id = (SELECT id FROM users WHERE iam_id = $1) AND following_id = $2",
  values: [followerIamId, followingId],
});

const relationshipCountsQuery = (userId) => ({
  text: `SELECT 
        (SELECT COUNT(*)::int FROM follows WHERE following_id = $1) as followers,
        (SELECT COUNT(*)::int FROM follows WHERE follower_id = $1) as following`,
  values: [userId],
});

const followersQuery = ({ userId, followerId, limit, offset }) => {
  const { addParameter, values } = queryParameters();
  const followingClause = `WHERE f.following_id = ${addParameter(userId)}`;
  const followerClause = followerId
    ? ` AND u.id = ${addParameter(followerId)}`
    : "";
  const limitPlaceholder = addParameter(limit);
  const offsetPlaceholder = addParameter(offset);

  return {
    text: `SELECT u.id, u.username FROM follows f JOIN users u ON f.follower_id = u.id ${followingClause}${followerClause} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values: values(),
  };
};

const followingQuery = ({ userId, limit, offset }) => ({
  text: "SELECT u.id, u.username FROM follows f JOIN users u ON f.following_id = u.id WHERE f.follower_id = $1 LIMIT $2 OFFSET $3",
  values: [userId, limit, offset],
});

const friendsQuery = ({ userId, usernameSearch, limit, offset }) => {
  const { addParameter, values } = queryParameters();
  const owner = addParameter(userId);
  const mutualClause = `WHERE f1.follower_id = ${owner} AND f2.following_id = ${owner}`;
  const searchClause = usernameSearch
    ? ` AND u.username ILIKE ${addParameter(`%${usernameSearch}%`)}`
    : "";
  const limitPlaceholder = addParameter(limit);
  const offsetPlaceholder = addParameter(offset);

  return {
    text: `SELECT u.id, u.username FROM users u JOIN follows f1 ON u.id = f1.following_id JOIN follows f2 ON u.id = f2.follower_id ${mutualClause}${searchClause} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values: values(),
  };
};

module.exports = {
  insertFollowQuery,
  deleteFollowQuery,
  relationshipCountsQuery,
  followersQuery,
  followingQuery,
  friendsQuery,
};
