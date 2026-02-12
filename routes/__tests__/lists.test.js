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

describe('Lists Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /lists', () => {
    it('should return all lists', async () => {
      const mockLists = [{ id: 1, name: 'Weekly Plan' }];
      pool.query.mockResolvedValue({ rows: mockLists });

      const res = await request(app).get('/lists');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockLists);
    });
  });

  describe('GET /lists/user/:userId', () => {
    it('should return lists for a specific user', async () => {
      const mockLists = [{ id: 1, user_id: 1, name: 'My List' }];
      pool.query.mockResolvedValue({ rows: mockLists });

      const res = await request(app).get('/lists/user/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockLists);
    });
  });

  describe('GET /lists/:id', () => {
    it('should return a single list', async () => {
      const mockList = { id: 1, name: 'Groceries' };
      pool.query.mockResolvedValue({ rows: [mockList] });

      const res = await request(app).get('/lists/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockList);
    });

    it('should return 404 if list not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const res = await request(app).get('/lists/999');
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST /lists', () => {
    it('should create a new list', async () => {
      const newList = { id: 2, user_id: 1, name: 'Party Prep' };
      pool.query.mockResolvedValue({ rows: [newList] });

      const res = await request(app).post('/lists').send({ user_id: 1, name: 'Party Prep' });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(newList);
    });
  });

  describe('DELETE /lists/:id', () => {
    it('should delete a list', async () => {
      const deletedList = { id: 1, name: 'Old List' };
      pool.query.mockResolvedValue({ rows: [deletedList] });

      const res = await request(app).delete('/lists/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({ message: 'List deleted successfully', list: deletedList });
    });

    it('should return 404 if list to delete not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const res = await request(app).delete('/lists/999');
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('GET /lists/:id/recipes', () => {
    it('should return recipes in a list', async () => {
      const mockRecipes = [{ id: 10, title: 'Cake' }];
      pool.query.mockResolvedValue({ rows: mockRecipes });

      const res = await request(app).get('/lists/1/recipes');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockRecipes);
    });
  });

  describe('POST /lists/:id/recipes', () => {
    it('should add a recipe to a list', async () => {
      const mockRelation = { list_id: 1, recipe_id: 10 };
      pool.query.mockResolvedValue({ rows: [mockRelation] });

      const res = await request(app).post('/lists/1/recipes').send({ recipe_id: 10 });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(mockRelation);
    });
  });
});