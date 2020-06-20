var express = require("express");
require("dotenv").config();
var router = express.Router();
const path = require("path");

// Serve the options path and set required headers
router.get("/options", (req, res, next) => {
  console.log("Inside get");
  console.log(req.get("Referer"));
  let referer = req.get("Referer");
  if (referer) {
    if (referer.indexOf("www.messenger.com") >= 0) {
      res.setHeader("X-Frame-Options", "ALLOW-FROM https://www.messenger.com/");
    } else if (referer.indexOf("www.facebook.com") >= 0) {
      res.setHeader("X-Frame-Options", "ALLOW-FROM https://www.facebook.com/");
    }
    console.log(__dirname);
    res.sendFile("options.html", {
      root: path.join(__dirname, "../src/pages"),
    });
  }
});

// Handle postback from webview
router.get("/optionspostback", (req, res) => {
  let body = req.query;
  let response = {
    text: `Great, I will book you a ${body.bed} bed, with ${body.pillows} pillows and a ${body.view} view.`,
  };

  res
    .status(200)
    .send("Please close this window to return to the conversation thread.");
  callSendAPI(body.psid, response);
});

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  console.log(
    `In call send API with sender id: ${sender_psid} and response ${response}`
  );
  //Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid,
    },
    message: response,
  };

  //Send the http request to the Messenger Platform
  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
      method: "POST",
      json: request_body,
    },
    (err, res, body) => {
      if (!err) {
        console.log("Message sent!");
      } else {
        console.error("Unable to send message:" + err);
      }
    }
  );
}

module.exports = router;
