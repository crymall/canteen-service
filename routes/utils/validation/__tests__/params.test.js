const { numericParam, parsedIdList } = require('../params');

describe('numericParam', () => {
  const runGuard = (value) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    numericParam('id')({}, res, next, value);
    return { res, next };
  };

  it('passes a run of digits through', () => {
    const { res, next } = runGuard('42');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each(['notanid', '1.5', '-1', '', '1; DROP TABLE recipes'])(
    'rejects %p with a 400 naming the parameter',
    (value) => {
      const { res, next } = runGuard(value);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'id must be a number.' });
      expect(next).not.toHaveBeenCalled();
    },
  );
});

describe('parsedIdList', () => {
  it('reads a comma-separated list as numbers', () => {
    expect(parsedIdList('1,2,3')).toEqual([1, 2, 3]);
  });

  it('reads a repeated query parameter as numbers', () => {
    expect(parsedIdList(['1', '2'])).toEqual([1, 2]);
  });

  it('treats an absent filter as no filter rather than an error', () => {
    expect(parsedIdList(undefined)).toEqual([]);
    expect(parsedIdList('')).toEqual([]);
  });

  it.each(['abc', '1,abc', '1, ,2', '-1'])(
    'returns null for %p so the route can answer 400',
    (input) => {
      expect(parsedIdList(input)).toBeNull();
    },
  );
});
