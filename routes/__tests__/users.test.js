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
      const mockUsers = [{ id: 1, iam_id: 'iam_001' }];
      pool.query.mockResolvedValue({ rows: mockUsers });

      const res = await request(app).get('/users');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockUsers);
    });
  });

  describe('GET /users/:id', () => {
    it('should return a user if found', async () => {
      const mockUser = { id: 1, iam_id: 'iam_001' };
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
    it('should create a new user and a default Favorites list', async () => {
      const newUser = { id: 2, iam_id: 'iam_123', username: 'new_user' };
      
      pool._mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [newUser] }) // INSERT user
        .mockResolvedValueOnce({ rows: [] }) // INSERT list
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app).post('/users').send({ iam_id: 'iam_123', username: 'new_user' });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(newUser);
      
      const clientCalls = pool._mockClient.query.mock.calls;
      expect(clientCalls[0][0]).toBe('BEGIN');
      expect(clientCalls[1][0]).toContain('INSERT INTO users');
      expect(clientCalls[2][0]).toContain('INSERT INTO lists');
      expect(clientCalls[2][1]).toEqual([2, 'Favorites']);
      expect(clientCalls[3][0]).toBe('COMMIT');
    });
  });
});