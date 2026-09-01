const { messagePayloadError, markReadPayloadError } = require('../messages');

describe('messagePayloadError', () => {
  it('accepts a message to a friend', () => {
    expect(messagePayloadError({ receiver_id: 2, content: 'Try this one' })).toBeNull();
  });

  it.each([undefined, 'abc', 0, -1])('rejects receiver_id %p', (receiver_id) => {
    expect(messagePayloadError({ receiver_id, content: 'hi' }))
      .toBe('receiver_id must be a number.');
  });

  it.each([undefined, '', '   ', 5])('rejects content %p', (content) => {
    expect(messagePayloadError({ receiver_id: 2, content })).toBe('A message needs content.');
  });
});

describe('markReadPayloadError', () => {
  it('accepts a list of message ids', () => {
    expect(markReadPayloadError({ message_ids: [1, 2] })).toBeNull();
  });

  it.each([undefined, [], 'all', {}])('rejects message_ids %p', (message_ids) => {
    expect(markReadPayloadError({ message_ids }))
      .toBe('message_ids must be a non-empty array');
  });

  it('rejects a list holding something that is not a number', () => {
    expect(markReadPayloadError({ message_ids: [1, 'abc'] }))
      .toBe('message_ids must contain only numbers.');
  });
});
