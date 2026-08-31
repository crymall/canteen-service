const { canonicalIngredientName } = require('../ingredients');

describe('canonicalIngredientName', () => {
  it('singularizes and title-cases so the same ingredient stores once', () => {
    expect(canonicalIngredientName('  all-purpose flours ')).toBe('All-purpose Flour');
    expect(canonicalIngredientName('EGGS')).toBe('Egg');
  });
});
