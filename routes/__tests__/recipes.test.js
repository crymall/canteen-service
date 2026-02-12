const request = require('supertest');
const app = require('../../app');
const pool = require('../../config/db');

jest.mock('../../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../middleware/authorize', () => ({
  authenticateToken: (req, res, next) => next(),
  authorizePermission: (permission) => (req, res, next) => next(),
}));

describe('Recipes Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /recipes', () => {
    it('should return a list of recipes', async () => {
      const mockRecipes = [{ id: 1, title: 'Pancakes' }];
      pool.query.mockResolvedValue({ rows: mockRecipes });

      const res = await request(app).get('/recipes');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockRecipes);
    });
  });

  describe('GET /recipes/:id', () => {
    it('should return a single recipe with details', async () => {
      const mockRecipe = {
        id: 1,
        title: 'Pancakes',
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
    });
  });

  describe('POST /recipes/:id/likes', () => {
    it('should like a recipe', async () => {
      const mockLike = { user_id: 1, recipe_id: 1 };
      pool.query.mockResolvedValue({ rows: [mockLike] });

      const res = await request(app).post('/recipes/1/likes').send({ user_id: 1 });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(mockLike);
    });
  });
});