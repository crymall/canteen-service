const request = require('supertest');
const app = require('../../app');
const pool = require('../../config/db');

jest.mock('../../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../middleware/authorize', () => ({
  authenticateToken: (req, res, next) => next(),
  authorizePermissions: (permissions) => (req, res, next) => next(),
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

    it('should filter ingredients by name', async () => {
      const mockIngredients = [{ id: 1, name: 'Salt' }];
      pool.query.mockResolvedValue({ rows: mockIngredients });

      const res = await request(app).get('/ingredients?name=Salt');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockIngredients);
      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('WHERE name ILIKE $1');
      expect(params[0]).toBe('%Salt%');
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValue(new Error('DB Error'));
      const res = await request(app).get('/ingredients');
      expect(res.statusCode).toEqual(500);
    });
  });

  describe('POST /ingredients', () => {
    it('should create a new ingredient and normalize the name', async () => {
      const newIngredient = { id: 2, name: 'Sweet Potato' };
      pool.query.mockResolvedValue({ rows: [newIngredient] });

      const res = await request(app).post('/ingredients').send({ name: '  sweet potatoes  ' });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(newIngredient);

      const [query, params] = pool.query.mock.calls[0];
      expect(query).toContain('INSERT INTO ingredients');
      expect(params[0]).toBe('Sweet Potato');
    });

    it('should return existing ingredient if there is a conflict', async () => {
      const existingIngredient = { id: 3, name: 'Apple' };
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // ON CONFLICT returns 0 rows
        .mockResolvedValueOnce({ rows: [existingIngredient] }); // SELECT fallback

      const res = await request(app).post('/ingredients').send({ name: 'apples' });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(existingIngredient);
      
      expect(pool.query.mock.calls[1][0]).toContain('SELECT * FROM ingredients');
      expect(pool.query.mock.calls[1][1][0]).toBe('Apple');
    });
  });
});