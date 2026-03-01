-- Insert Users (Hardcoded UUIDs for referencing)
INSERT INTO users (id, iam_id, username) VALUES 
(1, '1', 'crymall'),
(2, '2', 'test');

-- Insert Ingredients
INSERT INTO ingredients (name) VALUES 
('All-Purpose Flour'),
('Whole Milk'),
('Egg'),
('Salt'),
('Unsalted Butter'),
('Maple Syrup'),
('Rolled Oats'),
('Greek Yogurt'),
('Chia Seeds'),
('Whole Chicken'),
('Lemon'),
('Thyme');

-- Insert Tags
INSERT INTO tags (name) VALUES 
('Breakfast'),
('Vegetarian'),
('Quick & Easy'),
('Dinner'),
('Healthy');

-- Insert Recipes (Using author_id from above)
INSERT INTO recipes (id, author_id, title, description, instructions, prep_time_minutes, cook_time_minutes, wait_time_minutes, total_time_minutes, servings) VALUES 
(1, 1, 'Classic Pancakes', 'Fluffy homemade pancakes.', '1. Mix dry ingredients.\n2. Whisk wet ingredients.\n3. Combine and cook on griddle.', 10, 15, 0, 25, 4),
(2, 1, 'Scrambled Eggs', 'Creamy and soft.', '1. Whisk eggs with salt.\n2. Cook on low heat with butter.', 5, 5, 0, 10, 2),
(3, 1, 'Overnight Oats', 'Easy healthy breakfast.', '1. Mix oats, milk, yogurt, and chia seeds.\n2. Refrigerate overnight.', 5, 0, 480, 485, 1),
(4, 1, 'Roast Chicken', 'Classic Sunday dinner.', '1. Season chicken.\n2. Roast at 375F for 90 mins.\n3. Let rest.', 20, 90, 10, 120, 4);

-- Reset sequence for recipes to ensure next auto-increment is correct (optional but good practice)
SELECT setval('recipes_id_seq', (SELECT MAX(id) FROM recipes));

-- Link Ingredients to Recipes
-- Pancakes (Recipe 1)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes) VALUES 
(1, (SELECT id FROM ingredients WHERE name = 'All-Purpose Flour'), 1.5, 'cups', NULL),
(1, (SELECT id FROM ingredients WHERE name = 'Whole Milk'), 1.25, 'cups', NULL),
(1, (SELECT id FROM ingredients WHERE name = 'Egg'), 1, 'large', NULL);

-- Scrambled Eggs (Recipe 2)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes) VALUES 
(2, (SELECT id FROM ingredients WHERE name = 'Egg'), 3, 'large', NULL),
(2, (SELECT id FROM ingredients WHERE name = 'Unsalted Butter'), 1, 'tbsp', NULL);

-- Overnight Oats (Recipe 3)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes) VALUES 
(3, (SELECT id FROM ingredients WHERE name = 'Rolled Oats'), 0.5, 'cup', NULL),
(3, (SELECT id FROM ingredients WHERE name = 'Whole Milk'), 0.5, 'cup', NULL),
(3, (SELECT id FROM ingredients WHERE name = 'Greek Yogurt'), 0.25, 'cup', NULL),
(3, (SELECT id FROM ingredients WHERE name = 'Chia Seeds'), 1, 'tbsp', NULL);

-- Roast Chicken (Recipe 4)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes) VALUES 
(4, (SELECT id FROM ingredients WHERE name = 'Whole Chicken'), 1, 'whole', 'approx 4lbs'),
(4, (SELECT id FROM ingredients WHERE name = 'Unsalted Butter'), 2, 'tbsp', 'softened'),
(4, (SELECT id FROM ingredients WHERE name = 'Lemon'), 1, 'whole', 'halved');

-- Link Tags to Recipes
INSERT INTO recipe_tags (recipe_id, tag_id) VALUES 
(1, (SELECT id FROM tags WHERE name = 'Breakfast')),
(1, (SELECT id FROM tags WHERE name = 'Vegetarian')),
(2, (SELECT id FROM tags WHERE name = 'Breakfast')),
(2, (SELECT id FROM tags WHERE name = 'Quick & Easy')),
(3, (SELECT id FROM tags WHERE name = 'Breakfast')),
(3, (SELECT id FROM tags WHERE name = 'Healthy')),
(3, (SELECT id FROM tags WHERE name = 'Vegetarian')),
(4, (SELECT id FROM tags WHERE name = 'Dinner'));

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