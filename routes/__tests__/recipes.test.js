const request = require('supertest');
const app = require('../../app');
const pool = require('../../config/db');

jest.mock('../../config/db', () => ({
  query: jest.fn(),
}));

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
  });

  describe('GET /recipes/:id', () => {
    it('should return a single recipe with details', async () => {
      const mockRecipe = {
        id: 1,
        title: 'Pancakes',
        author: { id: 1, username: 'chef_john' },
        ingredients: [],
        tags: [],
        likes: []
      };
      pool.query.mockResolvedValue({ rows: [mockRecipe] });

      const res = await request(app).get('/recipes/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockRecipe);
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

  describe('PUT /recipes/:id', () => {
    it('should update a recipe if owned by user', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1, title: 'Updated' }] });
      const res = await request(app).put('/recipes/1').send({ title: 'Updated' });
      expect(res.statusCode).toEqual(200);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('author_id = $8');
      expect(params[7]).toBe(1); // req.user.id
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
        servings: 1
      };
      pool.query.mockResolvedValue({ rows: [newRecipe] });

      const res = await request(app).post('/recipes').send(newRecipe);
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(newRecipe);
      
      const [query, params] = pool.query.mock.calls[0];
      expect(params[0]).toBe(1); // req.user.id used as author_id
    });
  });

  describe('POST /recipes/:id/ingredients', () => {
    it('should add an ingredient to a recipe', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });
      const res = await request(app).post('/recipes/1/ingredients').send({ ingredient_id: 2, quantity: 1, unit: 'cup' });
      expect(res.statusCode).toEqual(201);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('INSERT INTO recipe_ingredients');
      expect(params[5]).toBe(1); // req.user.id
    });
  });

  describe('POST /recipes/:id/tags', () => {
    it('should add a tag to a recipe', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });
      const res = await request(app).post('/recipes/1/tags').send({ tag_id: 5 });
      expect(res.statusCode).toEqual(201);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('INSERT INTO recipe_tags');
      expect(params[2]).toBe(1); // req.user.id
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
      expect(params[0]).toBe(1); // req.user.id
    });
  });

  describe('DELETE /recipes/:id/likes', () => {
    it('should remove a like', async () => {
      pool.query.mockResolvedValue({ rows: [{ recipe_id: 1 }] });
      const res = await request(app).delete('/recipes/1/likes');
      expect(res.statusCode).toEqual(200);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('DELETE FROM recipe_likes');
      expect(params[1]).toBe(1); // req.user.id
    });
  });

  describe('DELETE /recipes/:id/tags/:tagId', () => {
    it('should remove a tag from a recipe', async () => {
      pool.query.mockResolvedValue({ rows: [{ recipe_id: 1 }] });
      const res = await request(app).delete('/recipes/1/tags/5');
      expect(res.statusCode).toEqual(200);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('DELETE FROM recipe_tags');
      expect(params[2]).toBe(1); // req.user.id
    });
  });

  describe('DELETE /recipes/:id/ingredients/:ingredientId', () => {
    it('should remove an ingredient from a recipe', async () => {
      pool.query.mockResolvedValue({ rows: [{ recipe_id: 1 }] });
      const res = await request(app).delete('/recipes/1/ingredients/10');
      expect(res.statusCode).toEqual(200);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('DELETE FROM recipe_ingredients');
      expect(params[2]).toBe(1); // req.user.id
    });
  });
});