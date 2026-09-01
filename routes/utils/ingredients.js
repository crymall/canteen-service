var pluralize = require("pluralize");

const toTitleCase = (str) =>
  str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const canonicalIngredientName = (name) =>
  toTitleCase(pluralize.singular(name.trim()));

module.exports = { canonicalIngredientName };
