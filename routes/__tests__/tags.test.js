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

describe('Tags Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /tags', () => {
    it('should return a list of tags', async () => {
      const mockTags = [{ id: 1, name: 'Vegan' }];
      pool.query.mockResolvedValue({ rows: mockTags });

      const res = await request(app).get('/tags');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockTags);
    });
  });

  describe('POST /tags', () => {
    it('should create a new tag', async () => {
      const newTag = { id: 2, name: 'Spicy' };
      pool.query.mockResolvedValue({ rows: [newTag] });

      const res = await request(app).post('/tags').send({ name: 'Spicy' });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(newTag);
    });
  });
});