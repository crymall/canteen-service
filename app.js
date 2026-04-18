require("dotenv").config();
var express = require("express");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");
var rateLimit = require("express-rate-limit");
var promBundle = require('express-prom-bundle');

var indexRouter = require("./routes/index");
var recipesRouter = require("./routes/recipes");
var ingredientsRouter = require("./routes/ingredients");
var tagsRouter = require("./routes/tags");
var listsRouter = require("./routes/lists");
var usersRouter = require("./routes/users");
var messagesRouter = require("./routes/messages");
var relationshipsRouter = require("./routes/relationships");

var app = express();

const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { app: 'canteen-service' },
  promClient: {
    collectDefaultMetrics: {}
  }
});

app.use(metricsMiddleware);

var limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(limiter);

app.use("/", indexRouter);
app.use("/recipes", recipesRouter);
app.use("/ingredients", ingredientsRouter);
app.use("/tags", tagsRouter);
app.use("/lists", listsRouter);
app.use("/users", usersRouter);
app.use("/messages", messagesRouter);
app.use("/relationships", relationshipsRouter);

module.exports = app;
