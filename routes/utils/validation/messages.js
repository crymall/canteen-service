const isSupplied = (value) => value !== undefined && value !== null;

const isPositiveInteger = (value) =>
  Number.isInteger(Number(value)) && Number(value) > 0;

const messagePayloadError = ({ receiver_id, content, recipe_id, list_id }) => {
  if (!isPositiveInteger(receiver_id)) {
    return "receiver_id must be a number.";
  }
  if (isSupplied(recipe_id) && !isPositiveInteger(recipe_id)) {
    return "recipe_id must be a number.";
  }
  if (isSupplied(list_id) && !isPositiveInteger(list_id)) {
    return "list_id must be a number.";
  }
  if (isSupplied(content) && typeof content !== "string") {
    return "content must be text.";
  }
  const hasWrittenContent = typeof content === "string" && content.trim() !== "";
  const hasSharedItem = isSupplied(recipe_id) || isSupplied(list_id);
  if (!hasWrittenContent && !hasSharedItem) {
    return "A message needs content, a recipe, or a list.";
  }
  return null;
};

const markReadPayloadError = ({ message_ids }) => {
  if (!Array.isArray(message_ids) || message_ids.length === 0) {
    return "message_ids must be a non-empty array";
  }
  if (message_ids.some((id) => !Number.isInteger(Number(id)))) {
    return "message_ids must contain only numbers.";
  }
  return null;
};

module.exports = { messagePayloadError, markReadPayloadError };
