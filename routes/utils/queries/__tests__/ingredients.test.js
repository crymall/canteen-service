const { ingredientsPageQuery } = require('../ingredients');

describe('ingredientsPageQuery', () => {
  it('sorts by name with an id tiebreaker so paging cannot repeat a row', () => {
    const { text, values } = ingredientsPageQuery({ limit: 50, offset: 0 });
    expect(text).toContain('ORDER BY name ASC, id ASC');
    expect(values).toEqual([50, 0]);
  });

  it('binds a name filter before the paging parameters', () => {
    const { text, values } = ingredientsPageQuery({ name: 'Salt', limit: 50, offset: 0 });
    expect(text).toContain('WHERE name ILIKE $1');
    expect(text).toContain('LIMIT $2 OFFSET $3');
    expect(values).toEqual(['%Salt%', 50, 0]);
  });
});
