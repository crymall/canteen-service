const request = require('supertest');
const app = require('../../app');
const pool = require('../../config/db');

jest.mock('../../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../middleware/authorize', () => ({
  authenticateToken: (req, res, next) => next(),
  authorizePermission: (permission) => (req, res, next) => next(),
  authenticateApiKey: (req, res, next) => next(),
}));

describe('Ingredients Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /ingredients', () => {
    it('should return a list of ingredients', async () => {
      const mockIngredients = [{ id: 1, name: 'Salt' }];
      pool.query.mockResolvedValue({ rows: mockIngredients });

      const res = await request(app).get('/ingredients');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockIngredients);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM ingredients'), expect.any(Array));
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValue(new Error('DB Error'));
      const res = await request(app).get('/ingredients');
      expect(res.statusCode).toEqual(500);
    });
  });

  describe('POST /ingredients', () => {
    it('should create a new ingredient', async () => {
      const newIngredient = { id: 2, name: 'Pepper' };
      pool.query.mockResolvedValue({ rows: [newIngredient] });

      const res = await request(app).post('/ingredients').send({ name: 'Pepper' });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(newIngredient);
    });
  });
});