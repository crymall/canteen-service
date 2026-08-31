const {
  friendshipQuery,
  messageThreadsQuery,
  messageThreadQuery,
  myMessagesQuery,
} = require('../messages');

describe('queries that resolve the caller from their IAM id', () => {
  const casesBindingCallerFirst = [
    ['friendshipQuery', friendshipQuery('7', '9')],
    ['messageThreadsQuery', messageThreadsQuery({ iamId: '7', limit: 50, offset: 0 })],
    ['messageThreadQuery', messageThreadQuery({ iamId: '7', otherUserId: '9', limit: 50, offset: 0 })],
    ['myMessagesQuery', myMessagesQuery({ iamId: '7', limit: 50, offset: 0 })],
  ];

  it.each(casesBindingCallerFirst)('binds the caller to $1 in %s', (_name, query) => {
    expect(query.text).toContain('(SELECT id FROM users WHERE iam_id = $1)');
    expect(query.values[0]).toBe('7');
  });
});

describe('messageThreadQuery', () => {
  it('matches the conversation in both directions', () => {
    const { text, values } = messageThreadQuery({
      iamId: '7',
      otherUserId: '9',
      limit: 50,
      offset: 0,
    });
    expect(text).toContain('m.receiver_id = $2');
    expect(text).toContain('m.sender_id = $2');
    expect(values).toEqual(['7', '9', 50, 0]);
  });
});
