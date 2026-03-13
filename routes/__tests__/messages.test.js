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

describe("Messages Routes", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /messages", () => {
    it("should send a message if users are friends", async () => {
      // Mock friend check returning a row (meaning they are friends)
      pool.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
      // Mock insert return
      const mockMessage = { id: 1, content: "hello", sender_id: 1, receiver_id: 2 };
      pool.query.mockResolvedValueOnce({ rows: [mockMessage] });

      const res = await request(app)
        .post("/messages")
        .send({ receiver_id: 2, content: "hello" });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual(mockMessage);
    });

    it("should return 403 if users are not friends", async () => {
      // Mock friend check returning empty (not friends)
      pool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post("/messages")
        .send({ receiver_id: 3, content: "hello" });

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toBe("You can only message friends");
    });
  });

  describe("PUT /messages/read", () => {
    it("should mark messages as read", async () => {
      const mockUpdatedMessages = [{ id: 1, is_read: true }];
      pool.query.mockResolvedValue({ rows: mockUpdatedMessages });

      const res = await request(app)
        .put("/messages/read")
        .send({ message_ids: [1], is_read: true });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockUpdatedMessages);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE messages"),
        [true, [1], 1]
      );
    });

    it("should return 400 if message_ids is invalid", async () => {
      const res = await request(app)
        .put("/messages/read")
        .send({ message_ids: "invalid" });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBe("message_ids must be a non-empty array");
    });
  });

  describe("GET /messages/threads", () => {
    it("should return conversation threads", async () => {
      const mockThreads = [{ id: 1, content: "last msg", other_username: "user2" }];
      pool.query.mockResolvedValue({ rows: mockThreads });

      const res = await request(app).get("/messages/threads");
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockThreads);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("WITH last_messages AS"),
        [1, 50, 0]
      );
    });

    it("should handle pagination params", async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await request(app).get("/messages/threads?limit=10&offset=5");
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("WITH last_messages AS"),
        [1, 10, 5]
      );
    });
  });

  describe("GET /messages/:id", () => {
    it("should return messages for a specific thread", async () => {
      const mockMessages = [{ id: 1, content: "hello" }];
      pool.query.mockResolvedValue({ rows: mockMessages });

      const res = await request(app).get("/messages/2");
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockMessages);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT m.*"),
        [1, "2", 50, 0]
      );
    });

    it("should handle pagination params", async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await request(app).get("/messages/2?limit=10&offset=5");
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT m.*"),
        [1, "2", 10, 5]
      );
    });
  });

  describe("GET /messages", () => {
    it("should return all messages for user", async () => {
      const mockMessages = [{ id: 1, content: "hello" }];
      pool.query.mockResolvedValue({ rows: mockMessages });

      const res = await request(app).get("/messages");
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockMessages);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT m.*"),
        [1, 50, 0]
      );
    });

    it("should handle pagination params", async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await request(app).get("/messages?limit=10&offset=5");
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT m.*"),
        [1, 10, 5]
      );
    });
  });
});