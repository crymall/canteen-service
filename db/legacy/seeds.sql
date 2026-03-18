-- Insert Users (Hardcoded UUIDs for referencing)
-- Insert Users (Hardcoded IDs for referencing)
-- Using ON CONFLICT DO NOTHING to make the script idempotent
INSERT INTO users (id, iam_id, username) VALUES 
(1, '1', 'crymall'),
(2, '2', 'test'),
(3, '3', 'newbie')
ON CONFLICT (id) DO NOTHING;

-- Insert Ingredients
INSERT INTO ingredients (name) VALUES 
('All-Purpose Flour'), ('Whole Milk'), ('Egg'), ('Salt'), ('Unsalted Butter'),
('Maple Syrup'), ('Rolled Oats'), ('Greek Yogurt'), ('Chia Seeds'), ('Whole Chicken'),
('Lemon'), ('Thyme'), ('Spaghetti'), ('Ground Beef'), ('Tomato Sauce'), ('Onion'),
('Garlic'), ('Romaine Lettuce'), ('Croutons'), ('Caesar Dressing'), ('Parmesan Cheese')
ON CONFLICT (name) DO NOTHING;

-- Insert Tags
INSERT INTO tags (name) VALUES 
('Breakfast'), ('Vegetarian'), ('Quick & Easy'), ('Dinner'), ('Healthy'),
('Italian'), ('Salad')
ON CONFLICT (name) DO NOTHING;

-- Insert Recipes (Using author_id from above)
INSERT INTO recipes (id, author_id, title, description, instructions, prep_time_minutes, cook_time_minutes, wait_time_minutes, total_time_minutes, servings) VALUES 
(1, 1, 'Classic Pancakes', 'Fluffy homemade pancakes.', '1. Mix dry ingredients.\n2. Whisk wet ingredients.\n3. Combine and cook on griddle.', 10, 15, 0, 25, 4),
(2, 1, 'Scrambled Eggs', 'Creamy and soft.', '1. Whisk eggs with salt.\n2. Cook on low heat with butter.', 5, 5, 0, 10, 2),
(3, 1, 'Overnight Oats', 'Easy healthy breakfast.', '1. Mix oats, milk, yogurt, and chia seeds.\n2. Refrigerate overnight.', 5, 0, 480, 485, 1),
(4, 1, 'Roast Chicken', 'Classic Sunday dinner.', '1. Season chicken.\n2. Roast at 375F for 90 mins.\n3. Let rest.', 20, 90, 10, 120, 4),
(5, 2, 'Spaghetti Bolognese', 'A rich and hearty meat sauce over pasta.', '1. Sauté onion and garlic.\n2. Brown ground beef.\n3. Add tomato sauce and simmer for 1 hour.\n4. Cook spaghetti and serve.', 15, 70, 0, 85, 6),
(6, 2, 'Caesar Salad', 'Crisp romaine with a creamy Caesar dressing.', '1. Chop romaine lettuce.\n2. Toss with dressing, croutons, and Parmesan cheese.', 10, 0, 0, 10, 2)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for recipes to ensure next auto-increment is correct
-- This is important when hardcoding IDs
SELECT setval('recipes_id_seq', (SELECT MAX(id) FROM recipes));

-- Link Ingredients to Recipes
-- Pancakes (Recipe 1)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes) VALUES 
(1, (SELECT id FROM ingredients WHERE name = 'All-Purpose Flour'), 1.5, 'cups', NULL),
(1, (SELECT id FROM ingredients WHERE name = 'Whole Milk'), 1.25, 'cups', NULL),
(1, (SELECT id FROM ingredients WHERE name = 'Egg'), 1, 'large', NULL)
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Scrambled Eggs (Recipe 2)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes) VALUES 
(2, (SELECT id FROM ingredients WHERE name = 'Egg'), 3, 'large', NULL),
(2, (SELECT id FROM ingredients WHERE name = 'Unsalted Butter'), 1, 'tbsp', NULL)
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Overnight Oats (Recipe 3)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes) VALUES 
(3, (SELECT id FROM ingredients WHERE name = 'Rolled Oats'), 0.5, 'cup', NULL),
(3, (SELECT id FROM ingredients WHERE name = 'Whole Milk'), 0.5, 'cup', NULL),
(3, (SELECT id FROM ingredients WHERE name = 'Greek Yogurt'), 0.25, 'cup', NULL),
(3, (SELECT id FROM ingredients WHERE name = 'Chia Seeds'), 1, 'tbsp', NULL)
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Roast Chicken (Recipe 4)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes) VALUES 
(4, (SELECT id FROM ingredients WHERE name = 'Whole Chicken'), 1, 'whole', 'approx 4lbs'),
(4, (SELECT id FROM ingredients WHERE name = 'Unsalted Butter'), 2, 'tbsp', 'softened'),
(4, (SELECT id FROM ingredients WHERE name = 'Lemon'), 1, 'whole', 'halved')
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Spaghetti Bolognese (Recipe 5)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) VALUES
(5, (SELECT id FROM ingredients WHERE name = 'Spaghetti'), 1, 'lb'),
(5, (SELECT id FROM ingredients WHERE name = 'Ground Beef'), 1, 'lb'),
(5, (SELECT id FROM ingredients WHERE name = 'Tomato Sauce'), 24, 'oz'),
(5, (SELECT id FROM ingredients WHERE name = 'Onion'), 1, 'medium')
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Caesar Salad (Recipe 6)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) VALUES
(6, (SELECT id FROM ingredients WHERE name = 'Romaine Lettuce'), 1, 'head'),
(6, (SELECT id FROM ingredients WHERE name = 'Croutons'), 1, 'cup'),
(6, (SELECT id FROM ingredients WHERE name = 'Caesar Dressing'), 0.5, 'cup'),
(6, (SELECT id FROM ingredients WHERE name = 'Parmesan Cheese'), 0.25, 'cup')
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Link Tags to Recipes
INSERT INTO recipe_tags (recipe_id, tag_id) VALUES 
-- Recipe 1
(1, (SELECT id FROM tags WHERE name = 'Breakfast')), (1, (SELECT id FROM tags WHERE name = 'Vegetarian')),
-- Recipe 2
(2, (SELECT id FROM tags WHERE name = 'Breakfast')), (2, (SELECT id FROM tags WHERE name = 'Quick & Easy')),
-- Recipe 3
(3, (SELECT id FROM tags WHERE name = 'Breakfast')), (3, (SELECT id FROM tags WHERE name = 'Healthy')), (3, (SELECT id FROM tags WHERE name = 'Vegetarian')),
-- Recipe 4
(4, (SELECT id FROM tags WHERE name = 'Dinner')),
-- Recipe 5
(5, (SELECT id FROM tags WHERE name = 'Dinner')), (5, (SELECT id FROM tags WHERE name = 'Italian')),
-- Recipe 6
(6, (SELECT id FROM tags WHERE name = 'Salad')), (6, (SELECT id FROM tags WHERE name = 'Quick & Easy')), (6, (SELECT id FROM tags WHERE name = 'Vegetarian'))
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- Create Default "Favorites" Lists for Users
INSERT INTO lists (user_id, name) VALUES 
(1, 'Favorites'),
(2, 'Favorites'),
(3, 'Favorites')
ON CONFLICT (user_id, name) DO NOTHING;

-- Add recipes to lists
INSERT INTO list_recipes (list_id, recipe_id) VALUES 
((SELECT id FROM lists WHERE user_id = 1 AND name = 'Favorites'), 4), -- crymall favorites Roast Chicken
((SELECT id FROM lists WHERE user_id = 2 AND name = 'Favorites'), 1)  -- test favorites Pancakes
ON CONFLICT (list_id, recipe_id) DO NOTHING;

-- Add Likes
INSERT INTO recipe_likes (user_id, recipe_id) VALUES 
-- test likes crymall's Pancakes
(2, 1),
-- crymall likes test's Spaghetti
(1, 5)
ON CONFLICT (user_id, recipe_id) DO NOTHING;

-- Add Follows
INSERT INTO follows (follower_id, following_id) VALUES 
-- crymall and test are friends
(1, 2), (2, 1),
-- crymall follows newbie (one-way)
(1, 3)
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- Add Messages
-- We'll clear the table to ensure a clean seed, as messages don't have a simple unique constraint for ON CONFLICT
DELETE FROM messages;
INSERT INTO messages (id, sender_id, receiver_id, content, recipe_id, created_at) VALUES 
(1, 2, 1, 'Hey crymall, your pancake recipe looks amazing!', NULL, NOW() - interval '2 day'),
(2, 1, 2, 'Thanks! You should try it. I saw you made a bolognese, I''m going to try it this week!', 5, NOW() - interval '1 day'),
(3, 2, 1, 'Awesome, let me know what you think!', NULL, NOW());

-- Reset sequence for messages
SELECT setval('messages_id_seq', (SELECT MAX(id) FROM messages));