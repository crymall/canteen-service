var { queryParameters } = require("../general");
var {
  FOLLOWING_FEED,
  FRIENDS_FEED,
  RECENT_FIRST,
  MOST_LIKED_FIRST,
} = require("../constants");
var {
  nullIfBlank,
  sumMinutes,
  singularUnit,
  groupName,
} = require("../recipeValues");

const recipeProjection = (viewerPlaceholder) => `
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
      AND rl.user_id = (SELECT id FROM users WHERE iam_id = ${viewerPlaceholder})
  ) AS liked_by_current_user
`;

const recipeGraphPageSql = ({
  filters,
  orderBy,
  limitPlaceholder,
  offsetPlaceholder,
  viewerPlaceholder,
}) => {
  const whereClause =
    filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  return `
      WITH page AS (
        SELECT r.id
        FROM recipes r
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
      )
      SELECT ${recipeProjection(viewerPlaceholder)}
      FROM page
      JOIN recipes r ON r.id = page.id
      LEFT JOIN users u ON r.author_id = u.id
      ORDER BY ${orderBy}
    `;
};

const recipeSearchQuery = ({
  title,
  ids = [],
  tags = [],
  ingredients = [],
  feed,
  viewerIamId,
  limit,
  offset,
}) => {
  const { addParameter, values } = queryParameters();
  const filters = [];

  if (title) {
    filters.push(`r.title ILIKE ${addParameter(`%${title}%`)}`);
  }

  if (ids.length > 0) {
    filters.push(`r.id = ANY(${addParameter(ids)}::bigint[])`);
  }

  if (tags.length > 0) {
    const tagIds = addParameter(tags);
    filters.push(`r.id IN (
        SELECT recipe_id
        FROM recipe_tags
        WHERE tag_id = ANY(${tagIds}::int[])
        GROUP BY recipe_id
        HAVING COUNT(DISTINCT tag_id) = array_length(${tagIds}::int[], 1)
      )`);
  }

  if (ingredients.length > 0) {
    const ingredientIds = addParameter(ingredients);
    filters.push(`r.id IN (
        SELECT rig.recipe_id
        FROM recipe_ingredients ri
        JOIN recipe_ingredient_groups rig ON ri.group_id = rig.id
        WHERE ri.ingredient_id = ANY(${ingredientIds}::int[])
        GROUP BY rig.recipe_id
        HAVING COUNT(DISTINCT ri.ingredient_id) = array_length(${ingredientIds}::int[], 1)
      )`);
  }

  if (feed === FOLLOWING_FEED) {
    const viewer = addParameter(viewerIamId);
    filters.push(`r.author_id IN (
        SELECT following_id FROM follows WHERE follower_id = (SELECT id FROM users WHERE iam_id = ${viewer})
      )`);
  } else if (feed === FRIENDS_FEED) {
    const viewer = addParameter(viewerIamId);
    filters.push(`r.author_id IN (
        SELECT f1.following_id
        FROM follows f1
        JOIN follows f2 ON f1.following_id = f2.follower_id
        WHERE f1.follower_id = (SELECT id FROM users WHERE iam_id = ${viewer}) AND f2.following_id = (SELECT id FROM users WHERE iam_id = ${viewer})
      )`);
  }

  const limitPlaceholder = addParameter(limit);
  const offsetPlaceholder = addParameter(offset);
  const viewerPlaceholder = addParameter(viewerIamId);

  return {
    text: recipeGraphPageSql({
      filters,
      orderBy: RECENT_FIRST,
      limitPlaceholder,
      offsetPlaceholder,
      viewerPlaceholder,
    }),
    values: values(),
  };
};

const popularRecipesQuery = ({ viewerIamId, limit, offset }) => {
  const { addParameter, values } = queryParameters();
  const limitPlaceholder = addParameter(limit);
  const offsetPlaceholder = addParameter(offset);
  const viewerPlaceholder = addParameter(viewerIamId);

  return {
    text: recipeGraphPageSql({
      filters: [],
      orderBy: MOST_LIKED_FIRST,
      limitPlaceholder,
      offsetPlaceholder,
      viewerPlaceholder,
    }),
    values: values(),
  };
};

const recipesByAuthorQuery = ({ authorId, viewerIamId, limit, offset }) => {
  const { addParameter, values } = queryParameters();
  const filters = [`r.author_id = ${addParameter(authorId)}`];
  const limitPlaceholder = addParameter(limit);
  const offsetPlaceholder = addParameter(offset);
  const viewerPlaceholder = addParameter(viewerIamId);

  return {
    text: recipeGraphPageSql({
      filters,
      orderBy: RECENT_FIRST,
      limitPlaceholder,
      offsetPlaceholder,
      viewerPlaceholder,
    }),
    values: values(),
  };
};

const selectRecipeGraphQuery = (recipeId, viewerIamId) => ({
  text: `SELECT ${recipeProjection("$2")}
     FROM recipes r
     LEFT JOIN users u ON r.author_id = u.id
     WHERE r.id = $1`,
  values: [recipeId, viewerIamId],
});

const insertRecipeQuery = ({
  iamId,
  title,
  description,
  instructions,
  prep_time_minutes,
  cook_time_minutes,
  wait_time_minutes,
  servings,
}) => ({
  text: `INSERT INTO recipes (author_id, title, description, instructions, prep_time_minutes, cook_time_minutes, wait_time_minutes, total_time_minutes, servings)
         SELECT id, $2, $3, $4, $5, $6, $7, $8, $9
         FROM users WHERE iam_id = $1
         RETURNING *`,
  values: [
    iamId,
    title,
    description,
    instructions,
    nullIfBlank(prep_time_minutes),
    nullIfBlank(cook_time_minutes),
    nullIfBlank(wait_time_minutes),
    sumMinutes(prep_time_minutes, cook_time_minutes, wait_time_minutes),
    nullIfBlank(servings),
  ],
});

const updateRecipeQuery = ({
  id,
  iamId,
  title,
  description,
  instructions,
  prep_time_minutes,
  cook_time_minutes,
  wait_time_minutes,
  servings,
}) => ({
  text: `UPDATE recipes
         SET title = $1, description = $2, instructions = $3, prep_time_minutes = $4,
             cook_time_minutes = $5, wait_time_minutes = $6, total_time_minutes = $7,
             servings = $8, updated_at = CURRENT_TIMESTAMP
         WHERE id = $9 AND author_id = (SELECT id FROM users WHERE iam_id = $10)
         RETURNING id`,
  values: [
    title,
    description,
    instructions,
    nullIfBlank(prep_time_minutes),
    nullIfBlank(cook_time_minutes),
    nullIfBlank(wait_time_minutes),
    sumMinutes(prep_time_minutes, cook_time_minutes, wait_time_minutes),
    nullIfBlank(servings),
    id,
    iamId,
  ],
});

const deleteRecipeQuery = (recipeId, iamId) => ({
  text: "DELETE FROM recipes WHERE id = $1 AND author_id = (SELECT id FROM users WHERE iam_id = $2) RETURNING *",
  values: [recipeId, iamId],
});

const deleteRecipeTagsQuery = (recipeId) => ({
  text: "DELETE FROM recipe_tags WHERE recipe_id = $1",
  values: [recipeId],
});

const insertRecipeTagsQuery = (recipeId, tags) => {
  if (!Array.isArray(tags) || tags.length === 0) return null;
  return {
    text: "INSERT INTO recipe_tags (recipe_id, tag_id) SELECT $1, unnest($2::int[])",
    values: [recipeId, tags],
  };
};

const deleteIngredientGroupsQuery = (recipeId) => ({
  text: "DELETE FROM recipe_ingredient_groups WHERE recipe_id = $1",
  values: [recipeId],
});

const insertIngredientGroupsQuery = (recipeId, ingredientGroups) => {
  if (!Array.isArray(ingredientGroups) || ingredientGroups.length === 0) {
    return null;
  }
  return {
    text: `INSERT INTO recipe_ingredient_groups (recipe_id, name, position)
           SELECT $1, name, ordinality - 1
           FROM unnest($2::varchar[]) WITH ORDINALITY AS g(name, ordinality)
           RETURNING id, position`,
    values: [recipeId, ingredientGroups.map(groupName)],
  };
};

const insertRecipeIngredientsQuery = (insertedGroupRows, ingredientGroups) => {
  const groupIdByPosition = new Map(
    insertedGroupRows.map((row) => [row.position, row.id]),
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

  if (groupIds.length === 0) return null;

  return {
    text: `INSERT INTO recipe_ingredients (group_id, ingredient_id, quantity, unit, notes, position)
           SELECT * FROM unnest($1::int[], $2::int[], $3::numeric[], $4::varchar[], $5::varchar[], $6::int[])`,
    values: [groupIds, ingredientIds, quantities, units, notes, positions],
  };
};

const insertRecipeLikeQuery = (recipeId, iamId) => ({
  text: `INSERT INTO recipe_likes (user_id, recipe_id)
         SELECT id, $2 FROM users WHERE iam_id = $1
         ON CONFLICT (user_id, recipe_id) DO UPDATE SET recipe_id = EXCLUDED.recipe_id
         RETURNING *`,
  values: [iamId, recipeId],
});

const deleteRecipeLikeQuery = (recipeId, iamId) => ({
  text: "DELETE FROM recipe_likes WHERE recipe_id = $1 AND user_id = (SELECT id FROM users WHERE iam_id = $2) RETURNING *",
  values: [recipeId, iamId],
});

module.exports = {
  recipeSearchQuery,
  popularRecipesQuery,
  recipesByAuthorQuery,
  selectRecipeGraphQuery,
  insertRecipeQuery,
  updateRecipeQuery,
  deleteRecipeQuery,
  deleteRecipeTagsQuery,
  insertRecipeTagsQuery,
  deleteIngredientGroupsQuery,
  insertIngredientGroupsQuery,
  insertRecipeIngredientsQuery,
  insertRecipeLikeQuery,
  deleteRecipeLikeQuery,
};
