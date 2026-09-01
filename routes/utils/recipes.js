var pluralize = require("pluralize");
var { UNIT_SYMBOLS_NEVER_PLURALIZED } = require("./constants");
var { unitKey } = require("./recipeValues");
var {
  insertIngredientGroupsQuery,
  insertRecipeIngredientsQuery,
} = require("./queries/recipes");

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
  formatRecipe,
  insertIngredientTree,
};
