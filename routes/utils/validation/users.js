const USERNAME_COLUMN_WIDTH = 50;
const IAM_ID_COLUMN_WIDTH = 255;

const userPayloadError = ({ iam_id, username }) => {
  if (typeof iam_id !== "string" || iam_id.trim() === "") {
    return "An iam_id is required.";
  }
  if (iam_id.length > IAM_ID_COLUMN_WIDTH) {
    return `An iam_id may be at most ${IAM_ID_COLUMN_WIDTH} characters.`;
  }
  if (typeof username !== "string" || username.trim() === "") {
    return "A username is required.";
  }
  if (username.trim().length > USERNAME_COLUMN_WIDTH) {
    return `A username may be at most ${USERNAME_COLUMN_WIDTH} characters.`;
  }
  return null;
};

module.exports = { userPayloadError };
