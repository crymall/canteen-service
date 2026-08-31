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

jest.mock('../../middleware/authorize');

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

    it('should scope the liked flag to no user when unauthenticated', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await request(app).get('/recipes');

      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('AS liked_by_current_user');
      expect(params[params.length - 1]).toBeNull();
    });

    it('should scope the liked flag to the authenticated user', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await request(app).get('/recipes').set('Cookie', 'token=a.b.c');

      const [, params] = pool.query.mock.calls[0];
      expect(params[params.length - 1]).toBe('1'); // req.user.id stringified
    });

    it('should order results deterministically so pagination cannot repeat or skip', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await request(app).get('/recipes');

      const [query] = pool.query.mock.calls[0];
      expect(query).toContain('ORDER BY r.created_at DESC, r.id DESC');
    });

    it('should include recipes whose author has been deleted', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await request(app).get('/recipes');

      const [query] = pool.query.mock.calls[0];
      expect(query).toContain('LEFT JOIN users u ON r.author_id = u.id');
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
      expect(groups[0].ingredients[0].display_name).toBe('Apples'); // > 1, no unit -> Pluralize name
      expect(groups[0].ingredients[1].display_unit).toBe('cup'); // == 1 -> Singular unit
      expect(groups[1].ingredients[0].display_unit).toBe('tablespoons'); // > 1 -> Pluralize unit
      expect(groups[1].ingredients[1].display_name).toBe('Lemon'); // < 1 -> Singular name

      // The stored values survive untouched so the edit form cannot post a
      // pluralized unit back and persist it.
      expect(groups[0].ingredients[0].name).toBe('Apple');
      expect(groups[1].ingredients[0].unit).toBe('tablespoon');
    });

    it('should not pluralize unit symbols', async () => {
      const mockRecipe = {
        id: 3,
        title: 'Symbol Test',
        author: { id: 1, username: 'chef_john' },
        ingredient_groups: [
          {
            id: 1, name: 'Main', position: 0, ingredients: [
              { id: 1, ingredient_id: 1, name: 'Butter', quantity: 2, unit: 'oz', position: 0 },
              { id: 2, ingredient_id: 2, name: 'Flour', quantity: 500, unit: 'g', position: 1 },
              { id: 3, ingredient_id: 3, name: 'Apple', quantity: 3, unit: null, position: 2 },
              { id: 4, ingredient_id: 4, name: 'Sugar', quantity: 2, unit: 'Cup', position: 3 },
            ]
          }
        ],
        tags: [],
      };
      pool.query.mockResolvedValue({ rows: [mockRecipe] });

      const res = await request(app).get('/recipes/3');
      const ings = res.body.ingredient_groups[0].ingredients;

      expect(ings[0].display_unit).toBe('oz');
      expect(ings[0].display_name).toBe('Butter');
      expect(ings[1].display_unit).toBe('g');
      expect(ings[1].display_name).toBe('Flour');
      expect(ings[2].display_unit).toBeNull();
      expect(ings[2].display_name).toBe('Apples');
      expect(ings[3].display_unit).toBe('Cups'); // casing preserved
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
      expect(query).toContain('ORDER BY r.like_count DESC, r.id DESC');
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
    const graphRow = {
      id: 1,
      title: 'Updated',
      author: { id: 1, username: 'chef_john' },
      tags: [{ id: 5, name: 'Brunch' }],
      ingredient_groups: [
        {
          id: 60, name: 'Main', position: 0, ingredients: [
            { id: 200, ingredient_id: 2, name: 'Egg', quantity: 3, unit: null, notes: null, position: 0 },
          ]
        },
      ],
    };

    const fullPayload = {
      title: 'Updated',
      description: 'Now with eggs',
      instructions: 'Whisk',
      prep_time_minutes: 10,
      cook_time_minutes: 20,
      wait_time_minutes: 30,
      servings: 2,
      tags: [5],
      ingredient_groups: [
        { name: 'Main', ingredients: [{ id: 2, quantity: 3, unit: '', notes: null }] },
        { name: 'Sauce', ingredients: [{ id: 3, quantity: 1, unit: 'cup', notes: 'warmed' }] },
      ],
    };

    it('should replace the recipe, its tags, and its groups in one transaction', async () => {
      pool._mockClient.query
        .mockResolvedValueOnce({ rows: [] })                                   // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })                          // UPDATE recipes
        .mockResolvedValueOnce({ rows: [] })                                   // DELETE recipe_tags
        .mockResolvedValueOnce({ rows: [] })                                   // INSERT recipe_tags
        .mockResolvedValueOnce({ rows: [] })                                   // DELETE recipe_ingredient_groups
        .mockResolvedValueOnce({ rows: [{ id: 61, position: 1 }, { id: 60, position: 0 }] }) // INSERT groups
        .mockResolvedValueOnce({ rows: [] })                                   // INSERT recipe_ingredients
        .mockResolvedValueOnce({ rows: [graphRow] })                           // SELECT graph
        .mockResolvedValueOnce({ rows: [] });                                  // COMMIT

      const res = await request(app).put('/recipes/1').send(fullPayload);
      expect(res.statusCode).toEqual(200);

      const calls = pool._mockClient.query.mock.calls;
      const statements = calls.map((call) => call[0]);
      const paramsFor = (fragment) =>
        calls.find((call) => call[0].includes(fragment))[1];

      expect(statements[0]).toBe('BEGIN');
      expect(statements[statements.length - 1]).toBe('COMMIT');

      const update = paramsFor('UPDATE recipes');
      expect(statements.some((sql) =>
        sql.includes('author_id = (SELECT id FROM users WHERE iam_id = $10)'))).toBe(true);
      expect(update[6]).toBe(60); // total_time_minutes
      expect(update[9]).toBe('1'); // req.user.id stringified

      expect(statements.some((sql) => sql.includes('DELETE FROM recipe_tags'))).toBe(true);
      expect(paramsFor('INSERT INTO recipe_tags')).toEqual(['1', [5]]);

      expect(statements.some((sql) =>
        sql.includes('DELETE FROM recipe_ingredient_groups'))).toBe(true);
      expect(paramsFor('INSERT INTO recipe_ingredient_groups')).toEqual(['1', ['Main', 'Sauce']]);

      const ingredients = paramsFor('INSERT INTO recipe_ingredients');
      // RETURNING row order is not guaranteed, so group ids map back by position.
      expect(ingredients[0]).toEqual([60, 61]);
      expect(ingredients[1]).toEqual([2, 3]);
      expect(ingredients[3]).toEqual([null, 'cup']); // blank unit normalized
      expect(ingredients[5]).toEqual([0, 0]);

      // Tags are replaced before groups, and both inside the transaction.
      expect(statements.indexOf('COMMIT')).toBeGreaterThan(
        statements.findIndex((sql) => sql.includes('INSERT INTO recipe_ingredients')));
    });

    it('should store units in their canonical singular form', async () => {
      pool._mockClient.query
        .mockResolvedValueOnce({ rows: [] })                                   // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })                          // UPDATE recipes
        .mockResolvedValueOnce({ rows: [] })                                   // DELETE recipe_ingredient_groups
        .mockResolvedValueOnce({ rows: [{ id: 60, position: 0 }] })            // INSERT groups
        .mockResolvedValueOnce({ rows: [] })                                   // INSERT recipe_ingredients
        .mockResolvedValueOnce({ rows: [graphRow] })                           // SELECT graph
        .mockResolvedValueOnce({ rows: [] });                                  // COMMIT

      await request(app).put('/recipes/1').send({
        title: 'Updated',
        instructions: 'Whisk',
        ingredient_groups: [{ name: 'Main', ingredients: [
          { id: 2, quantity: 2, unit: 'cups' },     // plural -> singular
          { id: 3, quantity: 2, unit: ' Tbsp ' },   // symbol -> trimmed, uninflected
          { id: 4, quantity: 1, unit: '' },         // blank -> null
        ]}],
      });

      const insert = pool._mockClient.query.mock.calls.find((call) =>
        call[0].includes('INSERT INTO recipe_ingredients'));
      expect(insert[1][3]).toEqual(['cup', 'Tbsp', null]);
    });

    it('should respond with the full recipe graph rather than the bare row', async () => {
      pool._mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [graphRow] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).put('/recipes/1').send({ title: 'Updated', instructions: 'Whisk' });
      expect(res.statusCode).toEqual(200);
      expect(res.body.tags).toEqual([{ id: 5, name: 'Brunch' }]);
      expect(res.body.ingredient_groups[0].ingredients[0].display_name).toBe('Eggs');
    });

    it('should leave collections untouched when their keys are absent', async () => {
      pool._mockClient.query
        .mockResolvedValueOnce({ rows: [] })            // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })   // UPDATE recipes
        .mockResolvedValueOnce({ rows: [graphRow] })    // SELECT graph
        .mockResolvedValueOnce({ rows: [] });           // COMMIT

      const res = await request(app).put('/recipes/1').send({ title: 'Updated', instructions: 'Whisk' });
      expect(res.statusCode).toEqual(200);

      const statements = pool._mockClient.query.mock.calls.map((call) => call[0]);
      expect(statements.some((sql) => sql.includes('DELETE FROM recipe_tags'))).toBe(false);
      expect(statements.some((sql) => sql.includes('DELETE FROM recipe_ingredient_groups'))).toBe(false);
    });

    it('should clear the tags when sent an empty array', async () => {
      pool._mockClient.query
        .mockResolvedValueOnce({ rows: [] })            // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })   // UPDATE recipes
        .mockResolvedValueOnce({ rows: [] })            // DELETE recipe_tags
        .mockResolvedValueOnce({ rows: [graphRow] })    // SELECT graph
        .mockResolvedValueOnce({ rows: [] });           // COMMIT

      const res = await request(app)
        .put('/recipes/1')
        .send({ title: 'Updated', instructions: 'Whisk', tags: [] });
      expect(res.statusCode).toEqual(200);

      const statements = pool._mockClient.query.mock.calls.map((call) => call[0]);
      expect(statements.some((sql) => sql.includes('DELETE FROM recipe_tags'))).toBe(true);
      expect(statements.some((sql) => sql.includes('INSERT INTO recipe_tags'))).toBe(false);
    });

    it('should return 404 and roll back when the caller is not the author', async () => {
      pool._mockClient.query
        .mockResolvedValueOnce({ rows: [] })   // BEGIN
        .mockResolvedValueOnce({ rows: [] })   // UPDATE recipes matches nothing
        .mockResolvedValueOnce({ rows: [] });  // ROLLBACK

      const res = await request(app).put('/recipes/999').send(fullPayload);
      expect(res.statusCode).toEqual(404);

      const statements = pool._mockClient.query.mock.calls.map((call) => call[0]);
      expect(statements).toContain('ROLLBACK');
      expect(statements.some((sql) => sql.includes('DELETE FROM recipe_tags'))).toBe(false);
      expect(pool._mockClient.release).toHaveBeenCalled();
    });

    it('should refuse a group list that omits Main', async () => {
      const res = await request(app).put('/recipes/1').send({
        title: 'Updated',
        instructions: 'Whisk',
        ingredient_groups: [{ name: 'Sauce', ingredients: [{ id: 3 }] }],
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('keeps a "Main" group');
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('should refuse an empty ingredient_groups array, which omits Main', async () => {
      const res = await request(app)
        .put('/recipes/1')
        .send({ title: 'Updated', instructions: 'Whisk', ingredient_groups: [] });

      expect(res.statusCode).toEqual(400);
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('should reject duplicate group names without opening a transaction', async () => {
      const res = await request(app).put('/recipes/1').send({
        title: 'Updated',
        instructions: 'Whisk',
        ingredient_groups: [
          { name: 'Sauce', ingredients: [] },
          { name: 'Sauce', ingredients: [] },
        ],
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('both named');
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('should allow the same ingredient twice in one group', async () => {
      pool._mockClient.query
        .mockResolvedValueOnce({ rows: [] })                          // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })                 // UPDATE recipes
        .mockResolvedValueOnce({ rows: [] })                          // DELETE recipe_ingredient_groups
        .mockResolvedValueOnce({ rows: [{ id: 60, position: 0 }] })   // INSERT groups
        .mockResolvedValueOnce({ rows: [] })                          // INSERT recipe_ingredients
        .mockResolvedValueOnce({ rows: [graphRow] })                  // SELECT graph
        .mockResolvedValueOnce({ rows: [] });                         // COMMIT

      const res = await request(app).put('/recipes/1').send({
        title: 'Updated',
        instructions: 'Whisk',
        ingredient_groups: [{ name: 'Main', ingredients: [
          { id: 2, quantity: 2, notes: 'beaten' },
          { id: 2, quantity: 1, notes: 'separated' },
        ]}],
      });

      expect(res.statusCode).toEqual(200);
      const insert = pool._mockClient.query.mock.calls.find((call) =>
        call[0].includes('INSERT INTO recipe_ingredients'));
      expect(insert[1][1]).toEqual([2, 2]);
      expect(insert[1][4]).toEqual(['beaten', 'separated']);
      expect(insert[1][5]).toEqual([0, 1]);
    });

    it('should reject a payload missing a NOT NULL column', async () => {
      const res = await request(app).put('/recipes/1').send({ title: 'Updated' });
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('Instructions are required');
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('should reject a non-array tags payload', async () => {
      const res = await request(app).put('/recipes/1').send({ title: 'Updated', instructions: 'Whisk', tags: 'nope' });
      expect(res.statusCode).toEqual(400);
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('should roll back when a statement fails mid-transaction', async () => {
      pool._mockClient.query
        .mockResolvedValueOnce({ rows: [] })               // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })      // UPDATE recipes
        .mockRejectedValueOnce(new Error('deadlock detected'))
        .mockResolvedValueOnce({ rows: [] });              // ROLLBACK

      const res = await request(app).put('/recipes/1').send(fullPayload);
      expect(res.statusCode).toEqual(500);
      expect(pool._mockClient.query.mock.calls.map((call) => call[0])).toContain('ROLLBACK');
      expect(pool._mockClient.release).toHaveBeenCalled();
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
        .mockResolvedValueOnce({ rows: [] }) // INSERT tags
        .mockResolvedValueOnce({ rows: [{ id: 51, position: 1 }, { id: 50, position: 0 }] }) // INSERT ingredient_groups
        .mockResolvedValueOnce({ rows: [] }) // INSERT ingredients
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app).post('/recipes').send({
        ...newRecipe,
        tags: [5],
        ingredient_groups: [
          { name: 'Main', ingredients: [{ id: 2, quantity: 1, unit: 'cup' }] },
          { name: 'Sauce', ingredients: [{ id: 3, quantity: 2, unit: 'tablespoon' }] }
        ]
      });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(newRecipe);

      const clientCalls = pool._mockClient.query.mock.calls;
      expect(clientCalls[0][0]).toBe('BEGIN');
      expect(clientCalls[1][0]).toContain('INSERT INTO recipes');
      expect(clientCalls[1][1][0]).toBe('1'); // req.user.id stringified
      expect(clientCalls[1][1][7]).toBe(15); // total_time_minutes
      expect(clientCalls[2][0]).toContain('INSERT INTO recipe_tags');
      expect(clientCalls[2][1]).toEqual([1, [5]]);
      expect(clientCalls[3][0]).toContain('INSERT INTO recipe_ingredient_groups');
      expect(clientCalls[3][1]).toEqual([1, ['Main', 'Sauce']]);
      expect(clientCalls[4][0]).toContain('INSERT INTO recipe_ingredients');
      // RETURNING row order is not guaranteed, so group ids map back by position.
      expect(clientCalls[4][1][0]).toEqual([50, 51]);
      expect(clientCalls[4][1][1]).toEqual([2, 3]);
      expect(clientCalls[4][1][5]).toEqual([0, 0]);
      expect(clientCalls[5][0]).toBe('COMMIT');
    });
  });

  describe('POST /recipes payload requirements', () => {
    it('should reject a create that omits ingredient_groups entirely', async () => {
      const res = await request(app)
        .post('/recipes')
        .send({ title: 'Bare', instructions: 'Do it' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('ingredient_groups is required');
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('should still reject a group list that omits Main', async () => {
      const res = await request(app).post('/recipes').send({
        title: 'Bare',
        instructions: 'Do it',
        ingredient_groups: [{ name: 'Sauce', ingredients: [] }],
      });

      expect(res.statusCode).toEqual(400);
      expect(pool.connect).not.toHaveBeenCalled();
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

});
