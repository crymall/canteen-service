/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // 1. Create the new groups table
  pgm.createTable("recipe_ingredient_groups", {
    id: "id",
    recipe_id: {
      type: "integer",
      notNull: true,
      references: '"recipes"',
      onDelete: "CASCADE",
    },
    name: { type: "varchar(100)", notNull: true },
    position: { type: "integer", notNull: true, default: 0 },
  });

  pgm.addConstraint("recipe_ingredient_groups", "unique_recipe_group_name", {
    unique: ["recipe_id", "name"],
  });

  // 2. Prepare recipe_ingredients for the transition
  pgm.dropConstraint("recipe_ingredients", "recipe_ingredients_pkey");

  pgm.addColumns("recipe_ingredients", {
    id: "id",
    group_id: { type: "integer" },
    position: { type: "integer", notNull: true, default: 0 },
  });

  // 3. Data Backfill (Preserving Data)
  // Create a group for every existing component_group string currently in use
  pgm.sql(`
    INSERT INTO recipe_ingredient_groups (recipe_id, name, position)
    SELECT DISTINCT recipe_id, component_group, 0 
    FROM recipe_ingredients;
  `);

  // Map all existing ingredients to their newly created group_id
  pgm.sql(`
    UPDATE recipe_ingredients ri
    SET group_id = rig.id
    FROM recipe_ingredient_groups rig
    WHERE ri.recipe_id = rig.recipe_id AND ri.component_group = rig.name;
  `);

  // 4. Enforce Constraints
  pgm.alterColumn("recipe_ingredients", "group_id", { notNull: true });

  pgm.addConstraint("recipe_ingredients", "fk_group_id", {
    foreignKeys: {
      columns: "group_id",
      references: "recipe_ingredient_groups(id)",
      onDelete: "CASCADE",
    },
  });

  pgm.addConstraint("recipe_ingredients", "unique_group_ingredient", {
    unique: ["group_id", "ingredient_id"],
  });

  // 5. Cleanup
  pgm.dropColumn("recipe_ingredients", "recipe_id");
  pgm.dropColumn("recipe_ingredients", "component_group");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // 1. Re-add the columns (nullable initially)
  pgm.addColumns("recipe_ingredients", {
    recipe_id: { type: "integer" },
    component_group: { type: "varchar(100)" },
  });

  // 2. Restore the data by joining through the groups table
  pgm.sql(`
    UPDATE recipe_ingredients ri
    SET 
      recipe_id = rig.recipe_id,
      component_group = rig.name
    FROM recipe_ingredient_groups rig
    WHERE ri.group_id = rig.id;
  `);

  // 3. Enforce the original constraints
  pgm.alterColumn("recipe_ingredients", "recipe_id", { notNull: true });
  pgm.alterColumn("recipe_ingredients", "component_group", {
    notNull: true,
    default: "Main",
  });

  pgm.addConstraint("recipe_ingredients", "fk_recipe_id", {
    foreignKeys: {
      columns: "recipe_id",
      references: "recipes(id)",
      onDelete: "CASCADE",
    },
  });

  // 4. Remove the new columns and constraints
  pgm.dropConstraint("recipe_ingredients", "unique_group_ingredient");
  pgm.dropConstraint("recipe_ingredients", "fk_group_id");
  pgm.dropColumn("recipe_ingredients", "id");
  pgm.dropColumn("recipe_ingredients", "group_id");
  pgm.dropColumn("recipe_ingredients", "position");

  // 5. Restore the original composite primary key
  pgm.addConstraint("recipe_ingredients", "recipe_ingredients_pkey", {
    primaryKey: ["recipe_id", "ingredient_id", "component_group"],
  });

  // 6. Drop the groups table entirely
  pgm.dropTable("recipe_ingredient_groups");
};
