var pluralize = require("pluralize");
var {
  UNGROUPED_GROUP_NAME,
  UNIT_SYMBOLS_NEVER_PLURALIZED,
} = require("./constants");

const nullIfBlank = (value) => (value === "" ? null : value);

const unitKey = (unit) =>
  typeof unit === "string" ? unit.trim().toLowerCase() : null;

const singularUnit = (unit) => {
  const trimmed = typeof unit === "string" ? unit.trim() : unit;
  const value = nullIfBlank(trimmed) ?? null;
  if (!value) return null;
  if (UNIT_SYMBOLS_NEVER_PLURALIZED.has(unitKey(value))) return value;
  return pluralize.singular(value);
};

const sumMinutes = (...values) =>
  values.reduce((total, value) => total + (parseInt(value) || 0), 0);

const groupName = (group) => group?.name || UNGROUPED_GROUP_NAME;

module.exports = {
  nullIfBlank,
  unitKey,
  singularUnit,
  sumMinutes,
  groupName,
};
