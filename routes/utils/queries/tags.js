const tagsPageQuery = ({ limit, offset }) => ({
  text: "SELECT * FROM tags ORDER BY name ASC, id ASC LIMIT $1 OFFSET $2",
  values: [limit, offset],
});

const insertTagQuery = (name) => ({
  text: "INSERT INTO tags (name) VALUES ($1) RETURNING *",
  values: [name],
});

module.exports = {
  tagsPageQuery,
  insertTagQuery,
};
