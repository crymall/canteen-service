/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.addColumn("recipes", {
    like_count: { type: "integer", notNull: true, default: 0 },
  });

  pgm.sql(`
    UPDATE recipes r
    SET like_count = COALESCE(counted.like_count, 0)
    FROM (
      SELECT recipe_id, COUNT(*)::int AS like_count
      FROM recipe_likes
      GROUP BY recipe_id
    ) counted
    WHERE counted.recipe_id = r.id;
  `);

  // ON CONFLICT DO UPDATE on a re-like fires the UPDATE path rather than the
  // INSERT path, so a repeated like cannot double-count.
  pgm.sql(`
    CREATE FUNCTION sync_recipe_like_count() RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        UPDATE recipes SET like_count = like_count + 1 WHERE id = NEW.recipe_id;
      ELSIF TG_OP = 'DELETE' THEN
        UPDATE recipes SET like_count = like_count - 1 WHERE id = OLD.recipe_id;
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER sync_recipe_like_count
    AFTER INSERT OR DELETE ON recipe_likes
    FOR EACH ROW EXECUTE FUNCTION sync_recipe_like_count();
  `);

  pgm.createIndex("recipes", [
    { name: "like_count", sort: "DESC" },
    { name: "id", sort: "DESC" },
  ]);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropIndex("recipes", ["like_count", "id"]);
  pgm.sql("DROP TRIGGER IF EXISTS sync_recipe_like_count ON recipe_likes;");
  pgm.sql("DROP FUNCTION IF EXISTS sync_recipe_like_count;");
  pgm.dropColumn("recipes", "like_count");
};
