const { messagePayloadError, markReadPayloadError } = require('../messages');

describe('messagePayloadError', () => {
  it('accepts a message to a friend', () => {
    expect(messagePayloadError({ receiver_id: 2, content: 'Try this one' })).toBeNull();
  });

  it('accepts a shared recipe with no written content', () => {
    expect(messagePayloadError({ receiver_id: 2, recipe_id: 7 })).toBeNull();
  });

  it('accepts a shared list with no written content', () => {
    expect(messagePayloadError({ receiver_id: 2, list_id: 7 })).toBeNull();
  });

  it('accepts a shared recipe alongside written content', () => {
    expect(messagePayloadError({ receiver_id: 2, content: 'Look at this', recipe_id: 7 }))
      .toBeNull();
  });

  it.each([undefined, 'abc', 0, -1])('rejects receiver_id %p', (receiver_id) => {
    expect(messagePayloadError({ receiver_id, content: 'hi' }))
      .toBe('receiver_id must be a number.');
  });

  it.each(['abc', 0, -1])('rejects recipe_id %p', (recipe_id) => {
    expect(messagePayloadError({ receiver_id: 2, recipe_id }))
      .toBe('recipe_id must be a number.');
  });

  it.each(['abc', 0, -1])('rejects list_id %p', (list_id) => {
    expect(messagePayloadError({ receiver_id: 2, list_id }))
      .toBe('list_id must be a number.');
  });

  it('rejects content that is not text', () => {
    expect(messagePayloadError({ receiver_id: 2, content: 5, recipe_id: 7 }))
      .toBe('content must be text.');
  });

  it.each([undefined, '', '   '])('rejects an empty message %p', (content) => {
    expect(messagePayloadError({ receiver_id: 2, content }))
      .toBe('A message needs content, a recipe, or a list.');
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
