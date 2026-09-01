var jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Access Denied: No Token Provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Access Denied: Invalid Token" });
    }

    req.user = user; 
    next();
  });
};

const optionalAuth = (req, res, next) => {
  if (req.cookies?.token) {
    return authenticateToken(req, res, next);
  }
  next();
};

const currentIamId = (req) => (req.user ? req.user.id.toString() : null);

const authorizePermissions = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const userPermissions = req.user.permissions || [];

    if (!userPermissions.includes(requiredPermission)) {
      return res.status(403).json({
        error: "Forbidden: You do not have permission to perform this action",
        required: requiredPermission
      });
    }

    next();
  };
};

const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.MIDDEN_API_KEY || 'dev_api_key';

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: "Access Denied: Invalid API Key" });
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  currentIamId,
  authorizePermissions,
  authenticateApiKey,
};
