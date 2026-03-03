const request = require("supertest");
const app = require("../../app");
const pool = require("../../config/db");

// Mock dependencies
jest.mock("../../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../../middleware/authorize", () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1 }; // Mock logged-in user with ID 1
    next();
  },
  authorizePermissions: (permissions) => (req, res, next) => next(),
  authenticateApiKey: (req, res, next) => next(),
}));

describe("Notifications Routes", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /notifications", () => {
    it("should return aggregated notifications", async () => {
      const mockNotifications = [
        { type: "message", id: "1", content: "hi" },
        { type: "follow", id: "follow_2" }
      ];
      pool.query.mockResolvedValue({ rows: mockNotifications });

      const res = await request(app).get("/notifications");
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockNotifications);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("UNION ALL"),
        [1, 50, 0] // Default limit 50, offset 0
      );
    });

    it("should handle pagination params", async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await request(app).get("/notifications?limit=10&offset=5");
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("UNION ALL"),
        [1, 10, 5]
      );
    });
  });
});