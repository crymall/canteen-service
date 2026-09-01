var pluralize = require("pluralize");
var {
  UNGROUPED_GROUP_NAME,
  UNIT_SYMBOLS_NEVER_PLURALIZED,
  CREATE,
} = require("./constants");
var { unitKey, groupName } = require("./recipeValues");
var {
  insertIngredientGroupsQuery,
  insertRecipeIngredientsQuery,
} = require("./queries/recipes");

const parseIdList = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(Number);
  return input.split(",").map(Number);
};

const formatRecipe = (recipe) => {
  if (!recipe.ingredient_groups) return recipe;
  const formattedGroups = recipe.ingredient_groups.map((group) => {
    const formattedIngredients = group.ingredients.map((ing) => {
      let displayName = ing.name;
      let displayUnit = ing.unit;

      if (ing.quantity && ing.quantity > 1) {
        if (!ing.unit) {
          displayName = pluralize(ing.name);
        } else if (!UNIT_SYMBOLS_NEVER_PLURALIZED.has(unitKey(ing.unit))) {
          displayUnit = pluralize(ing.unit);
        }
      }
      return {
        ...ing,
        display_name: displayName,
        display_unit: displayUnit,
      };
    });
    return { ...group, ingredients: formattedIngredients };
  });
  return { ...recipe, ingredient_groups: formattedGroups };
};

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

const insertIngredientTree = async (client, recipeId, ingredientGroups) => {
  const insertGroups = insertIngredientGroupsQuery(recipeId, ingredientGroups);
  if (!insertGroups) return;
  const inserted = await client.query(insertGroups);

  const insertIngredients = insertRecipeIngredientsQuery(
    inserted.rows,
    ingredientGroups,
  );
  if (!insertIngredients) return;
  await client.query(insertIngredients);
};

module.exports = {
  parseIdList,
  formatRecipe,
  recipePayloadError,
  insertIngredientTree,
};
