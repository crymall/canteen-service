const {
  recipeSearchQuery,
  popularRecipesQuery,
  recipesByAuthorQuery,
  selectRecipeGraphQuery,
  insertRecipeQuery,
  updateRecipeQuery,
  insertRecipeTagsQuery,
  insertIngredientGroupsQuery,
  insertRecipeIngredientsQuery,
} = require('../recipes');

const PAGE = { limit: 50, offset: 0, viewerIamId: '7' };

describe('recipeSearchQuery', () => {
  it('omits WHERE entirely when nothing is filtered', () => {
    const { text, values } = recipeSearchQuery(PAGE);
    expect(text).not.toContain('WHERE 1=1');
    expect(text).toMatch(/FROM recipes r\s+ORDER BY/);
    expect(values).toEqual([50, 0, '7']);
  });

  it('binds paging after the filters and the viewer last', () => {
    const { text, values } = recipeSearchQuery({ ...PAGE, title: 'Soup' });
    expect(text).toContain('r.title ILIKE $1');
    expect(text).toContain('LIMIT $2 OFFSET $3');
    expect(text).toContain('iam_id = $4');
    expect(values).toEqual(['%Soup%', 50, 0, '7']);
  });

  it('joins several filters with AND in the order they were given', () => {
    const { text, values } = recipeSearchQuery({
      ...PAGE,
      title: 'Soup',
      ids: [1, 2],
      tags: [3],
      ingredients: [4],
    });
    expect(text.indexOf('r.title ILIKE')).toBeLessThan(text.indexOf('r.id = ANY'));
    expect(text).toContain(' AND ');
    expect(values).toEqual(['%Soup%', [1, 2], [3], [4], 50, 0, '7']);
  });

  it('reuses one placeholder for the tag list it matches and counts', () => {
    const { text } = recipeSearchQuery({ ...PAGE, tags: [3, 9] });
    expect(text).toContain('tag_id = ANY($1::int[])');
    expect(text).toContain('array_length($1::int[], 1)');
  });

  it('reuses one placeholder for both sides of the friends feed', () => {
    const { text, values } = recipeSearchQuery({ ...PAGE, feed: 'friends' });
    expect(text.match(/f1\.follower_id = \(SELECT id FROM users WHERE iam_id = \$1\)/)).toBeTruthy();
    expect(text).toContain('f2.following_id = (SELECT id FROM users WHERE iam_id = $1)');
    expect(values).toEqual(['7', 50, 0, '7']);
  });

  it('ignores a feed value it does not recognize', () => {
    const { text } = recipeSearchQuery({ ...PAGE, feed: 'everyone' });
    expect(text).not.toContain('follows');
  });
});

describe('paged graph queries', () => {
  it('orders the search and the author page most recent first', () => {
    expect(recipeSearchQuery(PAGE).text).toContain('ORDER BY r.created_at DESC, r.id DESC');
    expect(recipesByAuthorQuery({ ...PAGE, authorId: '3' }).text)
      .toContain('ORDER BY r.created_at DESC, r.id DESC');
  });

  it('orders the popular page most liked first', () => {
    expect(popularRecipesQuery(PAGE).text).toContain('ORDER BY r.like_count DESC, r.id DESC');
  });

  it('filters the author page on the author and pages after it', () => {
    const { text, values } = recipesByAuthorQuery({ ...PAGE, authorId: '3' });
    expect(text).toContain('WHERE r.author_id = $1');
    expect(values).toEqual(['3', 50, 0, '7']);
  });

  it('keeps authorless recipes by joining users on the outside', () => {
    expect(popularRecipesQuery(PAGE).text).toContain('LEFT JOIN users u ON r.author_id = u.id');
  });
});

describe('selectRecipeGraphQuery', () => {
  it('takes the recipe first and the viewer second', () => {
    const { text, values } = selectRecipeGraphQuery('12', '7');
    expect(text).toContain('WHERE r.id = $1');
    expect(text).toContain('iam_id = $2');
    expect(values).toEqual(['12', '7']);
  });
});

describe('insertRecipeQuery and updateRecipeQuery', () => {
  const times = { prep_time_minutes: 10, cook_time_minutes: 15, wait_time_minutes: 5 };

  it('derives total_time_minutes from the three parts', () => {
    expect(insertRecipeQuery({ iamId: '1', ...times }).values[7]).toBe(30);
    expect(updateRecipeQuery({ id: '1', iamId: '1', ...times }).values[6]).toBe(30);
  });

  it('treats a missing time as zero rather than discarding the total', () => {
    expect(insertRecipeQuery({ iamId: '1', prep_time_minutes: 10 }).values[7]).toBe(10);
  });

  it('stores a blank numeric field as null', () => {
    const { values } = insertRecipeQuery({ iamId: '1', servings: '', prep_time_minutes: '' });
    expect(values[4]).toBeNull();
    expect(values[8]).toBeNull();
  });

  it('gates the update on the caller being the author', () => {
    const { text, values } = updateRecipeQuery({ id: '4', iamId: '7', title: 'T' });
    expect(text).toContain('WHERE id = $9 AND author_id = (SELECT id FROM users WHERE iam_id = $10)');
    expect(values[8]).toBe('4');
    expect(values[9]).toBe('7');
  });
});

describe('insertRecipeTagsQuery', () => {
  it('builds an insert for a non-empty tag list', () => {
    expect(insertRecipeTagsQuery('1', [5, 6]).values).toEqual(['1', [5, 6]]);
  });

  it('returns null when there is nothing to insert', () => {
    expect(insertRecipeTagsQuery('1', [])).toBeNull();
    expect(insertRecipeTagsQuery('1', undefined)).toBeNull();
  });
});

describe('insertIngredientGroupsQuery', () => {
  it('sends group names in array order and lets the database assign positions', () => {
    const { text, values } = insertIngredientGroupsQuery('1', [
      { name: 'Main' },
      { name: 'Sauce' },
    ]);
    expect(text).toContain('ordinality - 1');
    expect(values).toEqual(['1', ['Main', 'Sauce']]);
  });

  it('names an unnamed group Main', () => {
    expect(insertIngredientGroupsQuery('1', [{}]).values[1]).toEqual(['Main']);
  });

  it('returns null for an empty group list', () => {
    expect(insertIngredientGroupsQuery('1', [])).toBeNull();
  });
});

describe('insertRecipeIngredientsQuery', () => {
  const groups = [
    { name: 'Main', ingredients: [{ id: 2, quantity: 2, unit: 'cups' }] },
    { name: 'Sauce', ingredients: [{ id: 3, quantity: 1, unit: ' Tbsp ', notes: '' }] },
  ];

  it('maps each ingredient to its group by position, not by returned row order', () => {
    const shuffled = [
      { id: 61, position: 1 },
      { id: 60, position: 0 },
    ];
    expect(insertRecipeIngredientsQuery(shuffled, groups).values[0]).toEqual([60, 61]);
  });

  it('stores units in their canonical singular form', () => {
    const rows = [{ id: 60, position: 0 }, { id: 61, position: 1 }];
    expect(insertRecipeIngredientsQuery(rows, groups).values[3]).toEqual(['cup', 'Tbsp']);
  });

  it('normalizes blank units and notes to null', () => {
    const rows = [{ id: 60, position: 0 }];
    const { values } = insertRecipeIngredientsQuery(rows, [
      { name: 'Main', ingredients: [{ id: 2, quantity: 1, unit: '', notes: '' }] },
    ]);
    expect(values[3]).toEqual([null]);
    expect(values[4]).toEqual([null]);
  });

  it('numbers ingredients from zero within each group', () => {
    const rows = [{ id: 60, position: 0 }, { id: 61, position: 1 }];
    const { values } = insertRecipeIngredientsQuery(rows, [
      { name: 'Main', ingredients: [{ id: 2 }, { id: 3 }] },
      { name: 'Sauce', ingredients: [{ id: 4 }] },
    ]);
    expect(values[5]).toEqual([0, 1, 0]);
  });

  it('returns null when every group is empty', () => {
    const rows = [{ id: 60, position: 0 }];
    expect(insertRecipeIngredientsQuery(rows, [{ name: 'Main', ingredients: [] }])).toBeNull();
    expect(insertRecipeIngredientsQuery(rows, [{ name: 'Main' }])).toBeNull();
  });
});
