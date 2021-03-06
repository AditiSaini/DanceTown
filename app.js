var createError = require("http-errors");
var express = require("express");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var bodyParser = require("body-parser");
const mongoose = require("mongoose");

var webHook = require("./routes/webhook");
var options = require("./routes/options");

require("dotenv").config();

// Connecting to the mongodb server
const url = process.env.MONGO_URL;
const connect = mongoose.connect(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
connect
  .then(db => {
    console.log("MongoDB connected");
  })
  .catch(err => {
    console.log("MongoDB not connected");
    console.log(err);
  });

var app = express().use(bodyParser.json());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
require("dotenv").config();

app.use("/webhook", webHook);
app.use("/", options);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () =>
  console.log("Webhook is listening...")
);

module.exports = app;
