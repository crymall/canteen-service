var { queryParameters } = require("../general");

const ingredientsPageQuery = ({ name, limit, offset }) => {
  const { addParameter, values } = queryParameters();
  const whereClause = name
    ? ` WHERE name ILIKE ${addParameter(`%${name}%`)}`
    : "";
  const limitPlaceholder = addParameter(limit);
  const offsetPlaceholder = addParameter(offset);

  return {
    text: `SELECT * FROM ingredients${whereClause} ORDER BY name ASC, id ASC LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values: values(),
  };
};

const insertIngredientQuery = (canonicalName) => ({
  text: "INSERT INTO ingredients (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *",
  values: [canonicalName],
});

const ingredientByNameQuery = (canonicalName) => ({
  text: "SELECT * FROM ingredients WHERE name = $1",
  values: [canonicalName],
});

module.exports = {
  ingredientsPageQuery,
  insertIngredientQuery,
  ingredientByNameQuery,
};
