const request = require('supertest');
const app = require('../../app');
const pool = require('../../config/db');

jest.mock('../../config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../middleware/authorize');

const expectJsonError = (res, status) => {
  expect(res.status).toBe(status);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(typeof res.body.error).toBe('string');
};

describe('the request boundary', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe.each([
    ['/recipes/notanid'],
    ['/lists/notanid'],
    ['/users/notanid'],
    ['/messages/notanid'],
    ['/relationships/notanid/counts'],
  ])('%s', (path) => {
    it('answers 400 as JSON without reaching the database', async () => {
      expectJsonError(await request(app).get(path), 400);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ['/recipes?ids=abc'],
    ['/recipes?tags=abc'],
    ['/recipes?ingredients=abc'],
  ])('%s', (path) => {
    it('answers 400 as JSON without reaching the database', async () => {
      expectJsonError(await request(app).get(path), 400);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  it('answers a malformed JSON body as JSON rather than HTML', async () => {
    const res = await request(app)
      .post('/recipes')
      .set('Content-Type', 'application/json')
      .send('malformed-json');
    expectJsonError(res, 400);
  });

  it('answers a thrown database error as JSON without leaking its message', async () => {
    pool.query.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key value violates unique constraint'), {
        code: '23505',
      }),
    );
    const res = await request(app).get('/recipes/1');
    expectJsonError(res, 409);
    expect(res.text).not.toMatch(/unique constraint/);
  });

  it('answers an unmapped database error as a 500 with no stack trace', async () => {
    pool.query.mockRejectedValueOnce(new Error('connection terminated unexpectedly'));
    const res = await request(app).get('/recipes/1');
    expectJsonError(res, 500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
    expect(res.text).not.toMatch(/at .*\.js:\d+/);
  });
});

describe('write routes reject a bad payload before opening a connection', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
  });

  it.each([
    ['post', '/lists', {}],
    ['post', '/lists', { name: '   ' }],
    ['post', '/lists', { name: 'x'.repeat(101) }],
    ['post', '/lists/1/recipes', {}],
    ['post', '/ingredients', {}],
    ['post', '/ingredients', { name: 'x'.repeat(101) }],
    ['post', '/messages', { content: 'hi' }],
    ['post', '/messages', { receiver_id: 2 }],
    ['put', '/messages/read', {}],
    ['put', '/messages/read', { message_ids: [] }],
    ['put', '/messages/read', { message_ids: ['abc'] }],
    ['post', '/users', {}],
    ['post', '/users', { iam_id: 'iam_1' }],
  ])('%s %s %j', async (method, path, body) => {
    const res = await request(app)[method](path).send(body);
    expectJsonError(res, 400);
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
