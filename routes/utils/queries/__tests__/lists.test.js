const { listsPageQuery, listsByUserQuery } = require('../lists');

const PAGE = { limit: 50, offset: 0 };

describe('listsPageQuery', () => {
  it('sorts by created_at descending when nothing is asked for', () => {
    const { text, values } = listsPageQuery(PAGE);
    expect(text).toContain('ORDER BY created_at DESC');
    expect(text).toContain('LIMIT $1 OFFSET $2');
    expect(values).toEqual([50, 0]);
  });

  it('honours a sort column and direction it recognizes', () => {
    expect(listsPageQuery({ ...PAGE, sort: 'updated_at', order: 'asc' }).text)
      .toContain('ORDER BY updated_at ASC');
  });

  it('falls back to the default rather than interpolating an unknown column', () => {
    const { text } = listsPageQuery({ ...PAGE, sort: 'name; DROP TABLE lists', order: 'sideways' });
    expect(text).toContain('ORDER BY created_at DESC');
    expect(text).not.toContain('DROP TABLE');
  });

  it('binds a name filter before the paging parameters', () => {
    const { text, values } = listsPageQuery({ ...PAGE, name: 'Weeknight' });
    expect(text).toContain('WHERE name ILIKE $1');
    expect(text).toContain('LIMIT $2 OFFSET $3');
    expect(values).toEqual(['%Weeknight%', 50, 0]);
  });
});

describe('listsByUserQuery', () => {
  it('scopes to the owner and adds the name filter as a second condition', () => {
    const { text, values } = listsByUserQuery({ ...PAGE, userId: '4', name: 'Weeknight' });
    expect(text).toContain('WHERE user_id = $1');
    expect(text).toContain('AND name ILIKE $2');
    expect(values).toEqual(['4', '%Weeknight%', 50, 0]);
  });

  it('pages straight after the owner when no name is given', () => {
    const { text, values } = listsByUserQuery({ ...PAGE, userId: '4' });
    expect(text).toContain('LIMIT $2 OFFSET $3');
    expect(values).toEqual(['4', 50, 0]);
  });
});
