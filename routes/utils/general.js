const MAX_PAGE_SIZE = 50;

const queryParameters = () => {
  const accumulated = [];

  const addParameter = (value) => {
    accumulated.push(value);
    return `$${accumulated.length}`;
  };

  const values = () => [...accumulated];

  return { addParameter, values };
};

const pageBounds = (req) => ({
  limit: Math.min(parseInt(req.query.limit) || MAX_PAGE_SIZE, MAX_PAGE_SIZE),
  offset: parseInt(req.query.offset) || 0,
});

module.exports = { queryParameters, pageBounds };
