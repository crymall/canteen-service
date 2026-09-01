var { queryParameters } = require("../general");

const SORTABLE_COLUMNS = ["created_at", "updated_at"];
const SORT_DIRECTIONS = ["ASC", "DESC"];
const DEFAULT_SORT_COLUMN = "created_at";
const DEFAULT_SORT_DIRECTION = "DESC";

const listOrdering = (sort, order) => {
  const column = SORTABLE_COLUMNS.includes(sort) ? sort : DEFAULT_SORT_COLUMN;
  const direction = SORT_DIRECTIONS.includes(order)
    ? order
    : DEFAULT_SORT_DIRECTION;
  return `${column} ${direction}`;
};

const listsPageQuery = ({ name, sort, order, limit, offset }) => {
  const { addParameter, values } = queryParameters();
  const whereClause = name
    ? ` WHERE name ILIKE ${addParameter(`%${name}%`)}`
    : "";
  const ordering = listOrdering(sort, order);
  const limitPlaceholder = addParameter(limit);
  const offsetPlaceholder = addParameter(offset);

  return {
    text: `SELECT * FROM lists${whereClause} ORDER BY ${ordering} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values: values(),
  };
};

const listsByUserQuery = ({ userId, name, sort, order, limit, offset }) => {
  const { addParameter, values } = queryParameters();
  const ownerClause = ` WHERE user_id = ${addParameter(userId)}`;
  const nameClause = name
    ? ` AND name ILIKE ${addParameter(`%${name}%`)}`
    : "";
  const ordering = listOrdering(sort, order);
  const limitPlaceholder = addParameter(limit);
  const offsetPlaceholder = addParameter(offset);

  return {
    text: `SELECT * FROM lists${ownerClause}${nameClause} ORDER BY ${ordering} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values: values(),
  };
};

const listByIdQuery = (listId) => ({
  text: "SELECT * FROM lists WHERE id = $1",
  values: [listId],
});

const insertListQuery = (iamId, name) => ({
  text: `INSERT INTO lists (user_id, name)
         SELECT id, $2 FROM users WHERE iam_id = $1
         RETURNING *`,
  values: [iamId, name],
});

const deleteListQuery = (listId, iamId) => ({
  text: "DELETE FROM lists WHERE id = $1 AND user_id = (SELECT id FROM users WHERE iam_id = $2) RETURNING *",
  values: [listId, iamId],
});

const listRecipesQuery = ({ listId, limit, offset }) => ({
  text: `
      SELECT r.*
      FROM recipes r
      JOIN list_recipes lr ON r.id = lr.recipe_id
      WHERE lr.list_id = $1
      ORDER BY lr.added_at DESC, r.id DESC
      LIMIT $2 OFFSET $3
    `,
  values: [listId, limit, offset],
});

const insertListRecipeQuery = (listId, recipeId, iamId) => ({
  text: `INSERT INTO list_recipes (list_id, recipe_id)
       SELECT $1, $2
       WHERE EXISTS (SELECT 1 FROM lists WHERE id = $1 AND user_id = (SELECT id FROM users WHERE iam_id = $3))
       RETURNING *`,
  values: [listId, recipeId, iamId],
});

const deleteListRecipeQuery = (listId, recipeId, iamId) => ({
  text: "DELETE FROM list_recipes lr USING lists l WHERE lr.list_id = l.id AND lr.list_id = $1 AND lr.recipe_id = $2 AND l.user_id = (SELECT id FROM users WHERE iam_id = $3) RETURNING lr.*",
  values: [listId, recipeId, iamId],
});

module.exports = {
  listsPageQuery,
  listsByUserQuery,
  listByIdQuery,
  insertListQuery,
  deleteListQuery,
  listRecipesQuery,
  insertListRecipeQuery,
  deleteListRecipeQuery,
};
