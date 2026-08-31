const { followersQuery, friendsQuery } = require('../relationships');

const PAGE = { limit: 50, offset: 0 };

describe('followersQuery', () => {
  it('pages straight after the followed user when no follower is named', () => {
    const { text, values } = followersQuery({ ...PAGE, userId: '2' });
    expect(text).toContain('WHERE f.following_id = $1');
    expect(text).toContain('LIMIT $2 OFFSET $3');
    expect(values).toEqual(['2', 50, 0]);
  });

  it('narrows to a single follower when one is named', () => {
    const { text, values } = followersQuery({ ...PAGE, userId: '2', followerId: '3' });
    expect(text).toContain('AND u.id = $2');
    expect(values).toEqual(['2', '3', 50, 0]);
  });
});

describe('friendsQuery', () => {
  it('reuses one placeholder for both sides of the mutual follow', () => {
    const { text, values } = friendsQuery({ ...PAGE, userId: '2' });
    expect(text).toContain('f1.follower_id = $1 AND f2.following_id = $1');
    expect(values).toEqual(['2', 50, 0]);
  });

  it('binds a username search between the owner and the paging parameters', () => {
    const { text, values } = friendsQuery({ ...PAGE, userId: '2', usernameSearch: 'crym' });
    expect(text).toContain('AND u.username ILIKE $2');
    expect(text).toContain('LIMIT $3 OFFSET $4');
    expect(values).toEqual(['2', '%crym%', 50, 0]);
  });
});
