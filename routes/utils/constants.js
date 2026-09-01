const UNGROUPED_GROUP_NAME = "Main";
const UNIT_SYMBOLS_NEVER_PLURALIZED = new Set([
  "cl", "dl", "fl oz", "g", "gal", "kg", "l", "lb",
  "mg", "ml", "oz", "pt", "qt", "tbsp", "tsp",
]);
const CREATE = "create";
const UPDATE = "update";
const FOLLOWING_FEED = "following";
const FRIENDS_FEED = "friends";
const RECENT_FIRST = "r.created_at DESC, r.id DESC";
const MOST_LIKED_FIRST = "r.like_count DESC, r.id DESC";

module.exports = {
  UNGROUPED_GROUP_NAME,
  UNIT_SYMBOLS_NEVER_PLURALIZED,
  CREATE,
  UPDATE,
  FOLLOWING_FEED,
  FRIENDS_FEED,
  RECENT_FIRST,
  MOST_LIKED_FIRST
};