const request = require('supertest');
const app = require('../../app');
const pool = require('../../config/db');

jest.mock('../../config/db', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    query: jest.fn(),
    connect: jest.fn(() => Promise.resolve(mockClient)),
    _mockClient: mockClient,
  };
});

jest.mock('../../middleware/authorize', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1 };
    next();
  },
  authorizePermissions: (permissions) => (req, res, next) => next(),
  authenticateApiKey: (req, res, next) => next(),
}));

describe('Recipes Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /recipes', () => {
    it('should return a list of recipes', async () => {
      const mockRecipes = [{ id: 1, title: 'Pancakes', author: { id: 1, username: 'chef_john' } }];
      pool.query.mockResolvedValue({ rows: mockRecipes });

      const res = await request(app).get('/recipes');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockRecipes);
    });

    it('should filter recipes by title, tags, and ingredients', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await request(app).get('/recipes?title=Soup&tags=1,2&ingredients=3');
      
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('r.title ILIKE');
      expect(query).toContain('recipe_tags');
      expect(params[0]).toBe('%Soup%');
    });

    it('should filter recipes by multiple IDs', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await request(app).get('/recipes?ids=1,2,3');
      
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('r.id = ANY');
      expect(params[0]).toEqual([1, 2, 3]);
    });
  });

  describe('GET /recipes/:id', () => {
    it('should return a single recipe with details', async () => {
      const mockRecipe = {
        id: 1,
        title: 'Pancakes',
        author: { id: 1, username: 'chef_john' },
        ingredient_groups: [],
        tags: [],
        likes: []
      };
      pool.query.mockResolvedValue({ rows: [mockRecipe] });

      const res = await request(app).get('/recipes/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockRecipe);
    });

    it('should dynamically pluralize ingredients based on quantity', async () => {
      const mockRecipe = {
        id: 2,
        title: 'Fruit Salad',
        author: { id: 1, username: 'chef_john' },
        ingredient_groups: [
          {
            id: 1, name: 'Main', position: 0, ingredients: [
              { id: 1, ingredient_id: 1, name: 'Apple', quantity: 2, unit: null, position: 0 },
              { id: 2, ingredient_id: 2, name: 'Water', quantity: 1, unit: 'cup', position: 1 },
            ]
          },
          {
            id: 2, name: 'Dressing', position: 1, ingredients: [
              { id: 3, ingredient_id: 3, name: 'Sugar', quantity: 1.5, unit: 'tablespoon', position: 0 },
              { id: 4, ingredient_id: 4, name: 'Lemon', quantity: 0.5, unit: null, position: 1 }
            ]
          }
        ],
        tags: [],
        likes: []
      };
      pool.query.mockResolvedValue({ rows: [mockRecipe] });

      const res = await request(app).get('/recipes/2');
      expect(res.statusCode).toEqual(200);
      
      const groups = res.body.ingredient_groups;
      expect(groups[0].ingredients[0].name).toBe('Apples'); // > 1, no unit -> Pluralize name
      expect(groups[0].ingredients[1].unit).toBe('cup'); // == 1 -> Singular unit
      expect(groups[1].ingredients[0].unit).toBe('tablespoons'); // > 1 -> Pluralize unit
      expect(groups[1].ingredients[1].name).toBe('Lemon'); // < 1 -> Singular name
    });

    it('should return 404 if recipe not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const res = await request(app).get('/recipes/999');
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('GET /recipes/popular', () => {
    it('should return recipes sorted by likes', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await request(app).get('/recipes/popular');
      const [query] = pool.query.mock.calls[0];
      expect(query).toContain('ORDER BY like_count DESC');
    });
  });

  describe('GET /recipes/user/:userId', () => {
    it('should return recipes for a specific user', async () => {
      const mockRecipes = [{ id: 1, title: 'Pancakes', author: { id: 1, username: 'chef_john' } }];
      pool.query.mockResolvedValue({ rows: mockRecipes });

      const res = await request(app).get('/recipes/user/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockRecipes);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('WHERE r.author_id = $1');
      expect(params[0]).toBe('1');
    });
  });

  describe('PUT /recipes/:id', () => {
    it('should update a recipe if owned by user', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1, title: 'Updated' }] });
      const res = await request(app).put('/recipes/1').send({ 
        title: 'Updated',
        prep_time_minutes: 10,
        cook_time_minutes: 20,
        wait_time_minutes: 30
      });
      expect(res.statusCode).toEqual(200);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('author_id = (SELECT id FROM users WHERE iam_id = $10)');
      expect(params[6]).toBe(60); // total_time_minutes
      expect(params[9]).toBe('1'); // req.user.id stringified
    });
  });

  describe('DELETE /recipes/:id', () => {
    it('should delete a recipe if owned by user', async () => {
      const mockDeletedRecipe = { id: 1, title: 'Deleted' };
      pool.query.mockResolvedValue({ rows: [mockDeletedRecipe] });
      
      const res = await request(app).delete('/recipes/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({ message: 'Recipe deleted successfully', recipe: mockDeletedRecipe });
      
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('DELETE FROM recipes');
      expect(params[0]).toBe('1'); // req.params.id
      expect(params[1]).toBe('1'); // req.user.id stringified
    });

    it('should return 404 if recipe not found or unauthorized', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const res = await request(app).delete('/recipes/999');
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST /recipes', () => {
    it('should create a new recipe', async () => {
      const newRecipe = {
        id: 1,
        title: 'Omelette',
        author_id: 1,
        description: 'Fluffy eggs',
        instructions: 'Whisk and fry',
        prep_time_minutes: 5,
        cook_time_minutes: 5,
        wait_time_minutes: 5,
        total_time_minutes: 15,
        servings: 1
      };
      
      pool._mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [newRecipe] }) // INSERT recipe
        .mockResolvedValueOnce({ rows: [] }) // INSERT tag
        .mockResolvedValueOnce({ rows: [{ id: 50 }] }) // INSERT ingredient_group
        .mockResolvedValueOnce({ rows: [] }) // INSERT ingredient
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app).post('/recipes').send({
        ...newRecipe,
        tags: [5],
        ingredient_groups: [{ name: 'Main', ingredients: [{ id: 2, quantity: 1, unit: 'cup' }] }]
      });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(newRecipe);
      
      const clientCalls = pool._mockClient.query.mock.calls;
      expect(clientCalls[0][0]).toBe('BEGIN');
      expect(clientCalls[1][0]).toContain('INSERT INTO recipes');
      expect(clientCalls[1][1][0]).toBe('1'); // req.user.id stringified
      expect(clientCalls[1][1][7]).toBe(15); // total_time_minutes
      expect(clientCalls[2][0]).toContain('INSERT INTO recipe_tags');
      expect(clientCalls[3][0]).toContain('INSERT INTO recipe_ingredient_groups');
      expect(clientCalls[4][0]).toContain('INSERT INTO recipe_ingredients');
      expect(clientCalls[4][1][0]).toBe(50); // group_id mapped correctly
      expect(clientCalls[5][0]).toBe('COMMIT');
    });
  });

  describe('POST /recipes/:id/ingredients', () => {
    it('should add an ingredient to a recipe', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Recipe check
        .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // Group check
        .mockResolvedValueOnce({ rows: [{ next_pos: 2 }] }) // Max pos
        .mockResolvedValueOnce({ rows: [{ id: 100 }] }); // Insert ingredient

      const res = await request(app).post('/recipes/1/ingredients').send({ ingredient_id: 2, quantity: 1, unit: 'cup', group_name: 'Sauce' });
      expect(res.statusCode).toEqual(201);
      const [query, params] = pool.query.mock.calls[3];
      expect(query).toContain('INSERT INTO recipe_ingredients');
      expect(params[0]).toBe(10); // group_id
      expect(params[5]).toBe(2); // position
    });
  });

  describe('POST /recipes/:id/tags', () => {
    it('should add a tag to a recipe', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });
      const res = await request(app).post('/recipes/1/tags').send({ tag_id: 5 });
      expect(res.statusCode).toEqual(201);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('INSERT INTO recipe_tags');
      expect(params[2]).toBe('1'); // req.user.id stringified
    });
  });

  describe('POST /recipes/:id/likes', () => {
    it('should like a recipe', async () => {
      const mockLike = { user_id: 1, recipe_id: 1 };
      pool.query.mockResolvedValue({ rows: [mockLike] });

      const res = await request(app).post('/recipes/1/likes');
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(mockLike);
      const [query, params] = pool.query.mock.calls[0];
      expect(params[0]).toBe('1'); // req.user.id stringified
    });
  });

  describe('DELETE /recipes/:id/likes', () => {
    it('should remove a like', async () => {
      pool.query.mockResolvedValue({ rows: [{ recipe_id: 1 }] });
      const res = await request(app).delete('/recipes/1/likes');
      expect(res.statusCode).toEqual(200);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('DELETE FROM recipe_likes');
      expect(params[1]).toBe('1'); // req.user.id stringified
    });
  });

  describe('DELETE /recipes/:id/tags/:tagId', () => {
    it('should remove a tag from a recipe', async () => {
      pool.query.mockResolvedValue({ rows: [{ recipe_id: 1 }] });
      const res = await request(app).delete('/recipes/1/tags/5');
      expect(res.statusCode).toEqual(200);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('DELETE FROM recipe_tags');
      expect(params[2]).toBe('1'); // req.user.id stringified
    });
  });

  describe('DELETE /recipes/:id/ingredients/:ingredientId', () => {
    it('should remove an ingredient from a recipe', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 100 }] });
      const res = await request(app).delete('/recipes/1/ingredients/10?group=Main');
      expect(res.statusCode).toEqual(200);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('DELETE FROM recipe_ingredients');
      expect(params[2]).toBe('Main'); // default component_group
      expect(params[3]).toBe('1'); // req.user.id stringified
    });
  });

  describe('PUT /recipes/:id/groups/reorder', () => {
    it('should reorder groups', async () => {
      pool._mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // recipe check
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // UPDATE 1
        .mockResolvedValueOnce({ rows: [] }) // UPDATE 2
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app).put('/recipes/1/groups/reorder').send({ ordered_group_ids: [10, 11] });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({ message: 'Groups reordered successfully' });

      const calls = pool._mockClient.query.mock.calls;
      expect(calls[0][0]).toContain('SELECT id FROM recipes');
      expect(calls[2][0]).toContain('UPDATE recipe_ingredient_groups SET position = $1');
      expect(calls[2][1]).toEqual([0, 10, '1']);
      expect(calls[3][1]).toEqual([1, 11, '1']);
      expect(calls[4][0]).toBe('COMMIT');
    });
  });

  describe('PUT /recipes/:id/groups/:groupId', () => {
    it('should update a group name', async () => {
      const mockGroup = { id: 10, name: 'New Name', recipe_id: 1 };
      pool.query.mockResolvedValue({ rows: [mockGroup] });
      const res = await request(app).put('/recipes/1/groups/10').send({ name: 'New Name' });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockGroup);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('UPDATE recipe_ingredient_groups rig');
      expect(params).toEqual(['New Name', '10', '1', '1']);
    });
  });

  describe('DELETE /recipes/:id/groups/:groupId', () => {
    it('should delete a group', async () => {
      const mockGroup = { id: 10, name: 'Main' };
      pool.query.mockResolvedValue({ rows: [mockGroup] });
      const res = await request(app).delete('/recipes/1/groups/10');
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.group).toEqual(mockGroup);
    });
  });

  describe('PUT /recipes/:id/ingredients/reorder', () => {
    it('should reorder ingredients', async () => {
      pool._mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // recipe check
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // UPDATE 1
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app).put('/recipes/1/ingredients/reorder').send({ ordered_ingredient_ids: [100] });
      expect(res.statusCode).toEqual(200);
    });
  });

  describe('PUT /recipes/:id/ingredients/:recipeIngredientId/move', () => {
    it('should move an ingredient to a new group', async () => {
      const mockIngredient = { id: 100, group_id: 11 };
      pool.query.mockResolvedValue({ rows: [mockIngredient] });
      const res = await request(app).put('/recipes/1/ingredients/100/move').send({ group_id: 11 });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockIngredient);
    });
  });
});