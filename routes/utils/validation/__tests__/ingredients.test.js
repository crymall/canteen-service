const { ingredientPayloadError } = require('../ingredients');

describe('ingredientPayloadError', () => {
  it('accepts a named ingredient', () => {
    expect(ingredientPayloadError({ name: 'All-Purpose Flour' })).toBeNull();
  });

  it.each([undefined, null, '', '   ', 7])('rejects %p as a name', (name) => {
    expect(ingredientPayloadError({ name })).toBe('An ingredient name is required.');
  });

  it('rejects a name longer than the column', () => {
    expect(ingredientPayloadError({ name: 'x'.repeat(101) }))
      .toBe('An ingredient name may be at most 100 characters.');
  });
});
