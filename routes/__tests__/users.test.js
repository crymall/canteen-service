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

describe('Users Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users', () => {
    it('should return a list of users', async () => {
      const mockUsers = [{ id: 1, username: 'chef_john' }];
      pool.query.mockResolvedValue({ rows: mockUsers });

      const res = await request(app).get('/users');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockUsers);
    });
  });

  describe('GET /users/:id', () => {
    it('should return a user if found', async () => {
      const mockUser = { id: 1, username: 'chef_john' };
      pool.query.mockResolvedValue({ rows: [mockUser] });

      const res = await request(app).get('/users/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockUser);
    });

    it('should return 404 if user not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/users/999');
      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({ error: 'User not found' });
    });
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const newUser = { id: 2, username: 'chef_mary', iam_id: 'iam_123' };
      pool.query.mockResolvedValue({ rows: [newUser] });

      const res = await request(app).post('/users').send({ username: 'chef_mary', iam_id: 'iam_123' });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(newUser);
    });
  });
});