const messagePayloadError = ({ receiver_id, content }) => {
  if (!Number.isInteger(Number(receiver_id)) || Number(receiver_id) <= 0) {
    return "receiver_id must be a number.";
  }
  if (typeof content !== "string" || content.trim() === "") {
    return "A message needs content.";
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
