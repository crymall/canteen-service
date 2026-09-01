const POSITIVE_INTEGER = /^\d+$/;

const numericParam = (name) => (req, res, next, value) =>
  POSITIVE_INTEGER.test(value)
    ? next()
    : res.status(400).json({ error: `${name} must be a number.` });

const parsedIdList = (input) => {
  if (!input) return [];
  const supplied = Array.isArray(input) ? input : input.split(",");
  const ids = supplied.map((value) =>
    POSITIVE_INTEGER.test(String(value).trim()) ? Number(value) : null,
  );
  return ids.includes(null) ? null : ids;
};

module.exports = { numericParam, parsedIdList };
