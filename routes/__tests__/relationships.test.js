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

describe("Relationships Routes", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /relationships/:id", () => {
    it("should follow a user successfully", async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const res = await request(app).post("/relationships/2");
      
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual({ message: "Followed successfully" });
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO follows"),
        ["1", "2"]
      );
    });

    it("should prevent following yourself", async () => {
      const res = await request(app).post("/relationships/1");
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBe("Cannot follow yourself");
    });
  });

  describe("DELETE /relationships/:id", () => {
    it("should unfollow a user successfully", async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const res = await request(app).delete("/relationships/2");
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({ message: "Unfollowed successfully" });
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM follows"),
        ["1", "2"]
      );
    });
  });

  describe("GET /relationships/:id/counts", () => {
    it("should return follower and following counts", async () => {
      const mockCounts = { followers: 10, following: 5 };
      pool.query.mockResolvedValue({ rows: [mockCounts] });

      const res = await request(app).get("/relationships/2/counts");
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockCounts);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT COUNT(*)"),
        ["2"]
      );
    });
  });

  describe("GET /relationships/:id/followers", () => {
    it("should return followers list", async () => {
      const mockFollowers = [{ id: 3, username: "user3" }];
      pool.query.mockResolvedValue({ rows: mockFollowers });

      const res = await request(app).get("/relationships/2/followers");
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockFollowers);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT u.id, u.username FROM follows"),
        ["2", 50, 0]
      );
    });

    it("should filter followers by id if provided", async () => {
      const mockFollowers = [{ id: 3, username: "user3" }];
      pool.query.mockResolvedValue({ rows: mockFollowers });

      const res = await request(app).get("/relationships/2/followers?id=3");
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockFollowers);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("AND u.id = $2"),
        ["2", "3", 50, 0]
      );
    });
  });

  describe("GET /relationships/:id/following", () => {
    it("should return following list", async () => {
      const mockFollowing = [{ id: 4, username: "user4" }];
      pool.query.mockResolvedValue({ rows: mockFollowing });

      const res = await request(app).get("/relationships/2/following");
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockFollowing);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT u.id, u.username FROM follows"),
        ["2", 50, 0]
      );
    });
  });

  describe("GET /relationships/:id/friends", () => {
    it("should return friends list", async () => {
      const mockFriends = [{ id: 5, username: "user5" }];
      pool.query.mockResolvedValue({ rows: mockFriends });

      const res = await request(app).get("/relationships/2/friends");
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockFriends);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT u.id, u.username FROM users"),
        ["2", 50, 0]
      );
    });

    it("should filter friends by query if provided", async () => {
      const mockFriends = [{ id: 5, username: "user5" }];
      pool.query.mockResolvedValue({ rows: mockFriends });

      const res = await request(app).get("/relationships/2/friends?query=user");
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockFriends);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("AND u.username ILIKE $2"),
        ["2", "%user%", 50, 0]
      );
    });
  });
});