const { userPayloadError } = require('../users');

const VALID = { iam_id: 'iam_123', username: 'crymall' };

describe('userPayloadError', () => {
  it('accepts a synced user', () => {
    expect(userPayloadError(VALID)).toBeNull();
  });

  it.each([undefined, '', '   ', 123])('rejects iam_id %p', (iam_id) => {
    expect(userPayloadError({ ...VALID, iam_id })).toBe('An iam_id is required.');
  });

  it.each([undefined, '', '   ', 123])('rejects username %p', (username) => {
    expect(userPayloadError({ ...VALID, username })).toBe('A username is required.');
  });

  it('rejects a username longer than the column', () => {
    expect(userPayloadError({ ...VALID, username: 'x'.repeat(51) }))
      .toBe('A username may be at most 50 characters.');
  });

  it('rejects an iam_id longer than the column', () => {
    expect(userPayloadError({ ...VALID, iam_id: 'x'.repeat(256) }))
      .toBe('An iam_id may be at most 255 characters.');
  });
});
