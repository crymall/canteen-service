const request = require('supertest');
const app = require('../../app');

describe('Index Route', () => {
  it('GET / should return 404 with a hint message', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(404);
    expect(res.text).toContain("This isn't the route you probably meant to use");
  });
});