/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.dropConstraint("recipe_ingredients", "recipe_ingredients_pkey");
  pgm.addColumn("recipe_ingredients", {
    component_group: { type: "varchar(100)", default: "Main", notNull: true },
  });
  pgm.addConstraint("recipe_ingredients", "recipe_ingredients_pkey", {
    primaryKey: ["recipe_id", "ingredient_id", "component_group"],
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropConstraint('recipe_ingredients', 'recipe_ingredients_pkey');
  pgm.dropColumn("recipe_ingredients", "component_group");
  pgm.addConstraint('recipe_ingredients', 'recipe_ingredients_pkey', {
    primaryKey: ['recipe_id', 'ingredient_id'],
  });
};
