var pluralize = require("pluralize");
var { authenticateToken } = require("../../middleware/authorize");

const optionalAuth = (req, res, next) => {
  if (req.cookies?.token) {
    return authenticateToken(req, res, next);
  }
  next();
};

const currentIamId = (req) => (req.user ? req.user.id.toString() : null);
const UNGROUPED_GROUP_NAME = "Main";
const nullIfBlank = (value) => (value === "" ? null : value);
const UNIT_SYMBOLS_NEVER_PLURALIZED = new Set([
  "cl", "dl", "fl oz", "g", "gal", "kg", "l", "lb",
  "mg", "ml", "oz", "pt", "qt", "tbsp", "tsp",
]);
const unitKey = (unit) =>
  typeof unit === "string" ? unit.trim().toLowerCase() : null;
const singularUnit = (unit) => {
  const trimmed = typeof unit === "string" ? unit.trim() : unit;
  const value = nullIfBlank(trimmed) ?? null;
  if (!value) return null;
  if (UNIT_SYMBOLS_NEVER_PLURALIZED.has(unitKey(value))) return value;
  return pluralize.singular(value);
};
const sumMinutes = (...values) =>
  values.reduce((total, value) => total + (parseInt(value) || 0), 0);
const groupName = (group) => group?.name || UNGROUPED_GROUP_NAME;
const CREATE = "create";
const UPDATE = "update";

const recipeProjection = (viewerParam) => `
  r.*,
  CASE
    WHEN u.id IS NULL THEN NULL
    ELSE json_build_object('id', u.id, 'username', u.username)
  END AS author,
  (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', rig.id,
        'name', rig.name,
        'position', rig.position,
        'ingredients', (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', ri.id,
              'ingredient_id', i.id,
              'name', i.name,
              'quantity', ri.quantity,
              'unit', ri.unit,
              'notes', ri.notes,
              'position', ri.position
            ) ORDER BY ri.position ASC
          ), '[]')
          FROM recipe_ingredients ri
          JOIN ingredients i ON ri.ingredient_id = i.id
          WHERE ri.group_id = rig.id
        )
      ) ORDER BY rig.position ASC
    ), '[]')
    FROM recipe_ingredient_groups rig
    WHERE rig.recipe_id = r.id
  ) AS ingredient_groups,
  (
    SELECT COALESCE(json_agg(json_build_object(
      'id', t.id,
      'name', t.name
    )), '[]')
    FROM recipe_tags rt
    JOIN tags t ON rt.tag_id = t.id
    WHERE rt.recipe_id = r.id
  ) AS tags,
  EXISTS (
    SELECT 1 FROM recipe_likes rl
    WHERE rl.recipe_id = r.id
      AND rl.user_id = (SELECT id FROM users WHERE iam_id = $${viewerParam})
  ) AS liked_by_current_user
`;

const selectRecipeGraph = async (db, recipeId, viewerIamId) => {
  const result = await db.query(
    `SELECT ${recipeProjection(2)}
     FROM recipes r
     LEFT JOIN users u ON r.author_id = u.id
     WHERE r.id = $1`,
    [recipeId, viewerIamId],
  );
  return result.rows[0] || null;
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

const insertRecipeTags = async (transaction, recipeId, tags) => {
  if (!Array.isArray(tags) || tags.length === 0) return;
  await transaction.query(
    "INSERT INTO recipe_tags (recipe_id, tag_id) SELECT $1, unnest($2::int[])",
    [recipeId, tags],
  );
};

const insertIngredientGroups = async (transaction, recipeId, ingredientGroups) => {
  if (!Array.isArray(ingredientGroups) || ingredientGroups.length === 0) return;

  const groupRes = await transaction.query(
    `INSERT INTO recipe_ingredient_groups (recipe_id, name, position)
     SELECT $1, name, ordinality - 1
     FROM unnest($2::varchar[]) WITH ORDINALITY AS g(name, ordinality)
     RETURNING id, position`,
    [recipeId, ingredientGroups.map(groupName)],
  );

  const groupIdByPosition = new Map(
    groupRes.rows.map((row) => [row.position, row.id]),
  );

  const groupIds = [];
  const ingredientIds = [];
  const quantities = [];
  const units = [];
  const notes = [];
  const positions = [];

  ingredientGroups.forEach((group, groupPosition) => {
    if (!Array.isArray(group.ingredients)) return;
    group.ingredients.forEach((ing, ingredientPosition) => {
      groupIds.push(groupIdByPosition.get(groupPosition));
      ingredientIds.push(ing.id);
      quantities.push(nullIfBlank(ing.quantity));
      units.push(singularUnit(ing.unit));
      notes.push(nullIfBlank(ing.notes) ?? null);
      positions.push(ingredientPosition);
    });
  });

  if (groupIds.length === 0) return;

  await transaction.query(
    `INSERT INTO recipe_ingredients (group_id, ingredient_id, quantity, unit, notes, position)
     SELECT * FROM unnest($1::int[], $2::int[], $3::numeric[], $4::varchar[], $5::varchar[], $6::int[])`,
    [groupIds, ingredientIds, quantities, units, notes, positions],
  );
};

module.exports = {
  optionalAuth,
  currentIamId,
  nullIfBlank,
  sumMinutes,
  CREATE,
  UPDATE,
  recipeProjection,
  selectRecipeGraph,
  formatRecipe,
  recipePayloadError,
  insertRecipeTags,
  insertIngredientGroups,
};
