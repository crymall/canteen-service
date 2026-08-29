/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * `unique_group_ingredient` survived from the era when `recipe_ingredients` was
 * keyed on (recipe_id, ingredient_id, component_group) and the incremental
 * POST /:id/ingredients route needed protection against double-adds. Writes now
 * replace the whole graph in one transaction, so it guards nothing and blocks a
 * legitimate recipe: the same ingredient listed twice in a group, distinguished
 * by its notes ("2 Eggs (beaten)" alongside "1 Egg (separated)").
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.dropConstraint("recipe_ingredients", "unique_group_ingredient");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM recipe_ingredients ri
    USING recipe_ingredients keeper
    WHERE ri.group_id = keeper.group_id
      AND ri.ingredient_id = keeper.ingredient_id
      AND ri.id > keeper.id;
  `);

  pgm.addConstraint("recipe_ingredients", "unique_group_ingredient", {
    unique: ["group_id", "ingredient_id"],
  });
};
