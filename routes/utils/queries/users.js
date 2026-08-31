const usersPageQuery = ({ limit, offset }) => ({
  text: "SELECT id, username FROM users ORDER BY id ASC LIMIT $1 OFFSET $2",
  values: [limit, offset],
});

const userByIamIdQuery = (iamId) => ({
  text: "SELECT * FROM users WHERE iam_id = $1",
  values: [iamId],
});

const userByIdQuery = (userId) => ({
  text: "SELECT id, username FROM users WHERE id = $1",
  values: [userId],
});

const insertUserQuery = (iamId, username) => ({
  text: "INSERT INTO users (iam_id, username) VALUES ($1, $2) RETURNING *",
  values: [iamId, username],
});

const insertListForUserQuery = (userId, name) => ({
  text: "INSERT INTO lists (user_id, name) VALUES ($1, $2)",
  values: [userId, name],
});

const deleteUserByIamIdQuery = (iamId) => ({
  text: "DELETE FROM users WHERE iam_id = $1 RETURNING *",
  values: [iamId],
});

module.exports = {
  usersPageQuery,
  userByIamIdQuery,
  userByIdQuery,
  insertUserQuery,
  insertListForUserQuery,
  deleteUserByIamIdQuery,
};
