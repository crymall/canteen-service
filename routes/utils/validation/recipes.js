var { UNGROUPED_GROUP_NAME, CREATE } = require("../constants");
var { groupName } = require("../recipeValues");

const recipePayloadError = (
  { title, instructions, tags, ingredient_groups },
  operation,
) => {
  if (typeof title !== "string" || title.trim() === "") {
    return "A title is required.";
  }

  if (typeof instructions !== "string" || instructions.trim() === "") {
    return "Instructions are required.";
  }

  if (tags !== undefined && !Array.isArray(tags)) {
    return "tags must be an array of tag ids";
  }

  if (ingredient_groups === undefined) {
    return operation === CREATE
      ? "ingredient_groups is required when creating a recipe"
      : null;
  }
  if (!Array.isArray(ingredient_groups)) {
    return "ingredient_groups must be an array";
  }

  const seenGroupNames = new Set();
  for (const group of ingredient_groups) {
    const name = groupName(group);
    if (seenGroupNames.has(name)) {
      return `Two ingredient groups are both named "${name}". Give each group its own name.`;
    }
    seenGroupNames.add(name);

    if (group?.ingredients === undefined) continue;
    if (!Array.isArray(group.ingredients)) {
      return `Ingredients for group "${name}" must be an array`;
    }
  }

  if (!seenGroupNames.has(UNGROUPED_GROUP_NAME)) {
    return `Every recipe keeps a "${UNGROUPED_GROUP_NAME}" group for ungrouped ingredients.`;
  }

  return null;
};

module.exports = { recipePayloadError };
