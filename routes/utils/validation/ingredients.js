const INGREDIENT_NAME_COLUMN_WIDTH = 100;

const ingredientPayloadError = ({ name }) => {
  if (typeof name !== "string" || name.trim() === "") {
    return "An ingredient name is required.";
  }
  if (name.trim().length > INGREDIENT_NAME_COLUMN_WIDTH) {
    return `An ingredient name may be at most ${INGREDIENT_NAME_COLUMN_WIDTH} characters.`;
  }
  return null;
};

module.exports = { ingredientPayloadError };
