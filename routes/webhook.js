var express = require("express");
const request = require("request");
require("dotenv").config();

const mongoose = require("mongoose");

const Users = require("../models/users");

var router = express.Router();

router
  .route("/")
  // Adds support for GET requests to our webhook
  .get((req, res, next) => {
    console.log("Here...");
    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = "DANCETOWN_TOKEN";
    const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

    // Parse the query params
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {
      // Checks the mode and token sent is correct
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        // Responds with the challenge token from the request
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        // Responds with '403 Forbidden' if verify tokens do not match
        res.sendStatus(403);
      }
    }
  })
  // Creates the endpoint for our webhook
  .post((req, res, next) => {
    let body = req.body;

    // Checks this is an event from a page subscription
    if (body.object === "page") {
      // Iterates over each entry - there may be multiple if batched
      body.entry.forEach(function (entry) {
        // Gets the message. entry.messaging is an array, but
        // will only ever contain one message, so we get index 0
        let webhook_event = entry.messaging[0];
        console.log(webhook_event);

        //Get the sender PSID value
        let sender_psid = webhook_event.sender.id;
        console.log("Sender PSID: " + sender_psid);

        //Check if the event is a message or a postback
        //pass the event to the appropriate handler function
        if (webhook_event.message) {
          handleMessage(sender_psid, webhook_event.message);
        } else if (webhook_event.postback) {
          handlePostback(sender_psid, webhook_event.postback);
        }
      });

      // Returns a '200 OK' response to all requests
      res.status(200).send("EVENT_RECEIVED");
    } else {
      // Returns a '404 Not Found' if event is not from a page subscription
      res.sendStatus(404);
    }
  });

// Handles messages events
function handleMessage(sender_psid, received_message) {
  let response;

  //check if message contains text
  if (received_message.text) {
    //Create the payload for a basic text message
    response = {
      text: `Hello, You sent the message: "${received_message.text}".`,
    };
    // Users.create({ userId: sender_psid, name: "Aditi", state: 1 });
  }
  //Sends the response message
  callSendAPI(sender_psid, response);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
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
