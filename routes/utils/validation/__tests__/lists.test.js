const { listPayloadError, listRecipePayloadError } = require('../lists');

describe('listPayloadError', () => {
  it('accepts a named list', () => {
    expect(listPayloadError({ name: 'Weeknight' })).toBeNull();
  });

  it.each([undefined, null, '', '   ', 42, {}])('rejects %p as a name', (name) => {
    expect(listPayloadError({ name })).toBe('A list name is required.');
  });

  it('rejects a name longer than the column', () => {
    expect(listPayloadError({ name: 'x'.repeat(101) }))
      .toBe('A list name may be at most 100 characters.');
  });

  it('measures the trimmed name, matching what gets stored', () => {
    expect(listPayloadError({ name: `  ${'x'.repeat(100)}  ` })).toBeNull();
  });
});

describe('listRecipePayloadError', () => {
  it('accepts a numeric recipe_id', () => {
    expect(listRecipePayloadError({ recipe_id: 7 })).toBeNull();
    expect(listRecipePayloadError({ recipe_id: '7' })).toBeNull();
  });

  it.each([undefined, 'abc', 0, -1, 1.5])('rejects %p', (recipe_id) => {
    expect(listRecipePayloadError({ recipe_id })).toBe('recipe_id must be a number.');
  });
});
