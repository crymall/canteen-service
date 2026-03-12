-- Drop tables in reverse order of dependency to avoid foreign key constraints
DROP FUNCTION IF EXISTS update_list_timestamp CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS list_recipes CASCADE;
DROP TABLE IF EXISTS lists CASCADE;
DROP TABLE IF EXISTS follows CASCADE;
DROP TABLE IF EXISTS recipe_likes CASCADE;
DROP TABLE IF EXISTS recipe_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS recipe_ingredients CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    iam_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL
);

-- Follows
CREATE TABLE follows (
    follower_id INT REFERENCES users(id) ON DELETE CASCADE,
    following_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Recipes
CREATE TABLE recipes (
    id BIGSERIAL PRIMARY KEY,
    author_id INT REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT NOT NULL,
    prep_time_minutes INT,
    cook_time_minutes INT,
    wait_time_minutes INT,
    total_time_minutes INT,
    servings INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ingredients
CREATE TABLE ingredients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- Recipe_Ingredients
CREATE TABLE recipe_ingredients (
    recipe_id BIGINT REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id INT REFERENCES ingredients(id),
    quantity DECIMAL(10,2),
    unit VARCHAR(50),
    notes VARCHAR(100),
    PRIMARY KEY (recipe_id, ingredient_id)
);

-- Tags
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Recipe_Tags
CREATE TABLE recipe_tags (
    recipe_id BIGINT REFERENCES recipes(id) ON DELETE CASCADE,
    tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, tag_id)
);

-- Likes
CREATE TABLE recipe_likes (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    recipe_id BIGINT REFERENCES recipes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, recipe_id)
);

-- Lists
CREATE TABLE lists (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- List_Recipes
CREATE TABLE list_recipes (
    list_id BIGINT REFERENCES lists(id) ON DELETE CASCADE,
    recipe_id BIGINT REFERENCES recipes(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, recipe_id)
);

-- Messages
CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id INT REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    recipe_id BIGINT REFERENCES recipes(id) ON DELETE SET NULL,
    list_id BIGINT REFERENCES lists(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_recipes_title ON recipes(title);
CREATE INDEX idx_recipe_ingredients_ing_id ON recipe_ingredients(ingredient_id);
CREATE INDEX idx_recipe_tags_tag_id ON recipe_tags(tag_id);
CREATE INDEX idx_recipe_likes_recipe_id ON recipe_likes(recipe_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);

-- Functions & Triggers
CREATE OR REPLACE FUNCTION update_list_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE lists SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.list_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_list_updated_at
AFTER INSERT ON list_recipes
FOR EACH ROW
EXECUTE FUNCTION update_list_timestamp();