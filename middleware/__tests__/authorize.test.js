const jwt = require('jsonwebtoken');
const { authenticateToken, authorizePermissions, authenticateApiKey } = require('../authorize');

jest.mock('jsonwebtoken');

describe('Authorization Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test_secret';
    process.env.MIDDEN_API_KEY = 'test_api_key';
  });

  describe('authenticateToken', () => {
    it('should return 401 if no token is provided', () => {
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Access Denied: No Token Provided" });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if token is invalid', () => {
      req.headers['authorization'] = 'Bearer invalid_token';
      
      jwt.verify.mockImplementation((token, secret, cb) => {
        cb(new Error('Invalid token'), null);
      });

      authenticateToken(req, res, next);

      expect(jwt.verify).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Access Denied: Invalid Token" });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() and set req.user if token is valid', () => {
      req.headers['authorization'] = 'Bearer valid_token';
      const mockUser = { id: 1, username: 'test' };

      jwt.verify.mockImplementation((token, secret, cb) => {
        cb(null, mockUser);
      });

      authenticateToken(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('authorizePermissions', () => {
    it('should return 401 if user is not authenticated', () => {
      const middleware = authorizePermissions(['read:data']);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "User not authenticated" });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user lacks required permission', () => {
      req.user = { permissions: ['read:other'] };
      const middleware = authorizePermissions(['read:data']);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining("Forbidden"),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if user has required permission', () => {
      req.user = { permissions: ['read:data', 'write:data'] };
      const middleware = authorizePermissions(['read:data']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('authenticateApiKey', () => {
    it('should return 401 if api key is invalid or missing', () => {
      req.headers['x-api-key'] = 'wrong_key';
      authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Access Denied: Invalid API Key" });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if api key is valid', () => {
      req.headers['x-api-key'] = 'test_api_key';
      authenticateApiKey(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});