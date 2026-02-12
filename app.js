var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');
var recipesRouter = require('./routes/recipes');
var ingredientsRouter = require('./routes/ingredients');
var tagsRouter = require('./routes/tags');
var listsRouter = require('./routes/lists');

var app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', indexRouter);
app.use('/recipes', recipesRouter);
app.use('/ingredients', ingredientsRouter);
app.use('/tags', tagsRouter);
app.use('/lists', listsRouter);

module.exports = app;
