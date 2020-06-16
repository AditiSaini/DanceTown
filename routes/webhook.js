var express = require("express");
const request = require("request");
require("dotenv").config();

const Users = require("../models/users");
const ChatStatus = require("../models/chatstatus");

var router = express.Router();

// Your verify token. Should be a random string.
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

router
  // Adds support for GET requests to our webhook
  .get("/", (req, res) => {
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
  });

// Creates the endpoint for our webhook
router.post("/", (req, res) => {
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
        console.log("Its a postback");
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
async function handlePostback(sender_psid, received_postback) {
  //Get the payload for  the postback
  const payload = received_postback.payload;

  //Set the response and update the db based on the postback played
  console.log(`Payload: ${payload}`);
  switch (payload) {
    case "GREETING":
      console.log("In greeting...");
      await updateStatus(sender_psid, payload, handleGreetingPostback);
      // response = { text: "Welcome aboard!" };
      // console.log("in greeting...");
      break;
    // callSendAPI(sender_psid, response);
    default:
      console.log("Can't recognise payload!");
  }
}

function updateStatus(sender_psid, status, callback) {
  console.log("In update status");
  const query = { user_id: sender_psid };
  const update = { status: status };
  const options = { upsert: status === "GREETING" };

  ChatStatus.findOneAndUpdate(query, update, options).exec((err, cs) => {
    console.log("Update status to db: ", cs);
    callback(sender_psid);
  });
  // callback(sender_psid);
}

function handleGreetingPostback(sender_psid) {
  console.log("In handle greeting postback");
  request(
    {
      url: `https://graph.facebook.com/${sender_psid}`,
      qs: {
        access_token: PAGE_ACCESS_TOKEN,
        fields: "first_name",
      },
      method: "GET",
    },
    function (err, response, body) {
      var greeting = "";
      if (err) {
        console.log("Error getting user's name: " + err);
      } else {
        var bodyObj = JSON.parse(body);
        const name = bodyObj.first_name;
        greeting = "Hi " + name + "! ";
      }
      const message =
        greeting +
        "Welcome to DanceTown, a perfect place to showcase your skills. So let's get started?";
      greeting_payload = {
        text: message,
        quick_replies: [
          {
            content_type: "text",
            title: "Yes!",
            payload: "GREETING",
          },
          {
            content_type: "text",
            title: "No, maybe later",
            payload: "GREETING",
          },
        ],
      };
      callSendAPI(sender_psid, greeting_payload);
    }
  );
}

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
