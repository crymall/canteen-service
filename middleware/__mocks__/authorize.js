const { currentIamId } = jest.requireActual("../authorize");

const authenticateToken = (req, res, next) => {
  req.user = { id: 1 };
  next();
};

const optionalAuth = (req, res, next) => {
  if (req.cookies?.token) {
    return authenticateToken(req, res, next);
  }
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  currentIamId,
  authorizePermissions: () => (req, res, next) => next(),
  authenticateApiKey: (req, res, next) => next(),
};
