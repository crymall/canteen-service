const LIST_NAME_COLUMN_WIDTH = 100;

const listPayloadError = ({ name }) => {
  if (typeof name !== "string" || name.trim() === "") {
    return "A list name is required.";
  }
  if (name.trim().length > LIST_NAME_COLUMN_WIDTH) {
    return `A list name may be at most ${LIST_NAME_COLUMN_WIDTH} characters.`;
  }
  return null;
};

const listRecipePayloadError = ({ recipe_id }) =>
  Number.isInteger(Number(recipe_id)) && Number(recipe_id) > 0
    ? null
    : "recipe_id must be a number.";

module.exports = { listPayloadError, listRecipePayloadError };
