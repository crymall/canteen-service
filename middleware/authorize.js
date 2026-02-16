var jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access Denied: No Token Provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Access Denied: Invalid Token" });
    }

    req.user = user; 
    next();
  });
};

const authorizePermissions = (allowedPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const userPermissions = req.user.permissions || [];
    const permissionsAreAcceptable = allowedPermissions.some(permission => userPermissions.includes(permission));

    if (!permissionsAreAcceptable) {
      console.log("BANANA", userPermissions);
      return res.status(403).json({ 
        error: "Forbidden: You do not have permission to perform this action",
        required: allowedPermissions
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

module.exports = { authenticateToken, authorizePermissions, authenticateApiKey };