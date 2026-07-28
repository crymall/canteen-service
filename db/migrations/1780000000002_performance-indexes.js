/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createExtension("pg_trgm", { ifNotExists: true });

  // Recipe listings page by newest-first with an id tiebreaker.
  pgm.createIndex("recipes", [
    { name: "created_at", sort: "DESC" },
    { name: "id", sort: "DESC" },
  ]);

  // GET /recipes/user/:userId, the feed filters, and the author_id foreign key.
  pgm.createIndex("recipes", "author_id");

  // A btree on title cannot serve `title ILIKE '%...%'`; a trigram index can.
  pgm.dropIndex("recipes", "title", { name: "idx_recipes_title" });
  pgm.createIndex("recipes", [{ name: "title", opclass: "gin_trgm_ops" }], {
    name: "idx_recipes_title_trgm",
    method: "gin",
  });

  pgm.createIndex("ingredients", [{ name: "name", opclass: "gin_trgm_ops" }], {
    name: "idx_ingredients_name_trgm",
    method: "gin",
  });

  pgm.createIndex("users", [{ name: "username", opclass: "gin_trgm_ops" }], {
    name: "idx_users_username_trgm",
    method: "gin",
  });

  // Inbox and thread queries filter on sender_id or receiver_id and order by
  // created_at. These composites also serve the bare equality lookups via their
  // leftmost column, which makes the standalone receiver_id index redundant.
  pgm.createIndex("messages", [
    "receiver_id",
    { name: "created_at", sort: "DESC" },
  ]);
  pgm.createIndex("messages", [
    "sender_id",
    { name: "created_at", sort: "DESC" },
  ]);
  pgm.dropIndex("messages", "receiver_id", { name: "idx_messages_receiver_id" });

  // list_recipes primary key is (list_id, recipe_id), leaving reverse lookups
  // and the recipes cascade delete without an index.
  pgm.createIndex("list_recipes", "recipe_id");

  pgm.createIndex("lists", [
    "user_id",
    { name: "updated_at", sort: "DESC" },
  ]);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropIndex("lists", ["user_id", "updated_at"]);
  pgm.dropIndex("list_recipes", "recipe_id");
  pgm.createIndex("messages", "receiver_id", { name: "idx_messages_receiver_id" });
  pgm.dropIndex("messages", ["sender_id", "created_at"]);
  pgm.dropIndex("messages", ["receiver_id", "created_at"]);
  pgm.dropIndex("users", "username", { name: "idx_users_username_trgm" });
  pgm.dropIndex("ingredients", "name", { name: "idx_ingredients_name_trgm" });
  pgm.dropIndex("recipes", "title", { name: "idx_recipes_title_trgm" });
  pgm.createIndex("recipes", "title", { name: "idx_recipes_title" });
  pgm.dropIndex("recipes", "author_id");
  pgm.dropIndex("recipes", ["created_at", "id"]);
  pgm.dropExtension("pg_trgm", { ifExists: true });
};
