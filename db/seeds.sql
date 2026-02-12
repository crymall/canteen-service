-- Insert Users (Hardcoded UUIDs for referencing)
INSERT INTO users (id, iam_id, username) VALUES 
(1, '13', 'crymall'),
(2, '2', 'bob_editor');

-- Insert Ingredients
INSERT INTO ingredients (name) VALUES 
('All-Purpose Flour'),
('Whole Milk'),
('Eggs'),
('Salt'),
('Unsalted Butter'),
('Maple Syrup');

-- Insert Tags
INSERT INTO tags (name) VALUES 
('Breakfast'),
('Vegetarian'),
('Quick & Easy');

-- Insert Recipes (Using author_id from above)
INSERT INTO recipes (id, author_id, title, description, instructions, prep_time_minutes, cook_time_minutes, servings) VALUES 
(1, 1, 'Classic Pancakes', 'Fluffy homemade pancakes.', '1. Mix dry ingredients.\n2. Whisk wet ingredients.\n3. Combine and cook on griddle.', 10, 15, 4),
(2, 2, 'Scrambled Eggs', 'Creamy and soft.', '1. Whisk eggs with salt.\n2. Cook on low heat with butter.', 5, 5, 2);

-- Reset sequence for recipes to ensure next auto-increment is correct (optional but good practice)
SELECT setval('recipes_id_seq', (SELECT MAX(id) FROM recipes));

-- Link Ingredients to Recipes
-- Pancakes (Recipe 1)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes) VALUES 
(1, (SELECT id FROM ingredients WHERE name = 'All-Purpose Flour'), 1.5, 'cups', NULL),
(1, (SELECT id FROM ingredients WHERE name = 'Whole Milk'), 1.25, 'cups', NULL),
(1, (SELECT id FROM ingredients WHERE name = 'Eggs'), 1, 'large', NULL);

-- Scrambled Eggs (Recipe 2)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes) VALUES 
(2, (SELECT id FROM ingredients WHERE name = 'Eggs'), 3, 'large', NULL),
(2, (SELECT id FROM ingredients WHERE name = 'Unsalted Butter'), 1, 'tbsp', NULL);

-- Link Tags to Recipes
INSERT INTO recipe_tags (recipe_id, tag_id) VALUES 
(1, (SELECT id FROM tags WHERE name = 'Breakfast')),
(1, (SELECT id FROM tags WHERE name = 'Vegetarian')),
(2, (SELECT id FROM tags WHERE name = 'Breakfast')),
(2, (SELECT id FROM tags WHERE name = 'Quick & Easy'));

-- Create Default "Favorites" Lists for Users
INSERT INTO lists (user_id, name) VALUES 
(1, 'Favorites'),
(2, 'Favorites');

-- Add 'Pancakes' to Chef Mario's Favorites
INSERT INTO list_recipes (list_id, recipe_id) VALUES 
((SELECT id FROM lists WHERE user_id = 2 AND name = 'Favorites'), 1);

-- Add a Like (Chef Mario likes Home Cook's Pancakes)
INSERT INTO recipe_likes (user_id, recipe_id) VALUES 
(2, 1);