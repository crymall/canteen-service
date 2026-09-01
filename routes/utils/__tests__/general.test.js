const { queryParameters, pageBounds } = require('../general');

describe('queryParameters', () => {
  it('numbers placeholders from one in the order they are added', () => {
    const { addParameter } = queryParameters();
    expect(addParameter('a')).toBe('$1');
    expect(addParameter('b')).toBe('$2');
  });

  it('keeps each placeholder aligned with the value that produced it', () => {
    const { addParameter, values } = queryParameters();
    const first = addParameter('a');
    const second = addParameter('b');
    expect(values()[Number(first.slice(1)) - 1]).toBe('a');
    expect(values()[Number(second.slice(1)) - 1]).toBe('b');
  });

  it('adds nothing when a placeholder is reused rather than re-added', () => {
    const { addParameter, values } = queryParameters();
    const ids = addParameter([1, 2]);
    expect(`ANY(${ids}) AND array_length(${ids}, 1)`).toBe(
      'ANY($1) AND array_length($1, 1)',
    );
    expect(values()).toEqual([[1, 2]]);
  });

  it('hands back a snapshot that later additions cannot change', () => {
    const { addParameter, values } = queryParameters();
    addParameter('a');
    const snapshot = values();
    addParameter('b');
    expect(snapshot).toEqual(['a']);
    expect(values()).toEqual(['a', 'b']);
  });

  it('hands back a copy that a caller cannot mutate into the accumulator', () => {
    const { addParameter, values } = queryParameters();
    addParameter('a');
    values().push('tampered');
    expect(values()).toEqual(['a']);
  });

  it('keeps separate accumulators independent', () => {
    const first = queryParameters();
    const second = queryParameters();
    first.addParameter('a');
    expect(second.addParameter('b')).toBe('$1');
    expect(first.values()).toEqual(['a']);
    expect(second.values()).toEqual(['b']);
  });
});

describe('pageBounds', () => {
  it('defaults to a full page from the start', () => {
    expect(pageBounds({ query: {} })).toEqual({ limit: 50, offset: 0 });
  });

  it('honours a smaller page size', () => {
    expect(pageBounds({ query: { limit: '10', offset: '20' } }))
      .toEqual({ limit: 10, offset: 20 });
  });

  it('caps the page size so one request cannot ask for everything', () => {
    expect(pageBounds({ query: { limit: '5000' } }).limit).toBe(50);
  });

  it('falls back to the defaults for values it cannot parse', () => {
    expect(pageBounds({ query: { limit: 'lots', offset: 'later' } }))
      .toEqual({ limit: 50, offset: 0 });
  });
});
