var express = require('express');
var router = express.Router();

/* GET hint message. */
router.get('/', function(req, res, next) {
  res.status(404).send("This isn't the route you probably meant to use! Try /recipes, /ingredients, /tags, or /lists instead.");
});

module.exports = router;
