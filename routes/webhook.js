var express = require("express");
const request = require("request");
require("dotenv").config();

const Users = require("../models/users");
const ChatStatus = require("../models/chatstatus");

var router = express.Router();

// Your verify token. Should be a random string.
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const SERVER_URL = process.env.SERVER_URL;

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
        console.log("Message is a text");
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
async function handleMessage(sender_psid, received_message) {
  let response;
  // const payload = received_message.quick_reply.payload;
  //check if message contains text
  if (received_message.text) {
    switch (
      received_message.text
        .replace(/[^\w\s]/gi, "")
        .trim()
        .toLowerCase()
    ) {
      case "room preferences":
        console.log("In room pref switch case");
        response = {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text:
                "OK, let's set your room preferences so I won't need to ask for them in the future.",
              buttons: [
                {
                  type: "web_url",
                  url: SERVER_URL + "/options",
                  title: "Set preferences",
                  webview_height_ratio: "compact",
                  messenger_extensions: true,
                },
              ],
            },
          },
        };
        console.log(response);
        break;
      default:
        response = {
          text: `You sent the message: "${received_message.text}".`,
        };
        break;
    }
    //Sends the response message
    callSendAPI(sender_psid, response);
  } else {
    response = {
      text: `Sorry, I don't understand what you mean.`,
    };
    //Create the payload for a basic text message
    // switch (payload) {
    //   case "LATER_DANCETOWN":
    //     console.log("In later dancetown...");
    //     await updateStatus(sender_psid, payload, handleLaterPostback);
    //     break;
    //   case "START_DANCETOWN":
    //     console.log("In start dancetown...");
    //     await updateStatus(sender_psid, payload, handleStartPostback);
    //     break;
    //   case "START_CHALLENGE":
    //     console.log("Start a challenge");
    //     await updateStatus(sender_psid, payload, handleStartChallenge);
    //     break;
    //   default:
    //     response = {
    //       text: `Hello, You sent the message: "${received_message.text}".`,
    //     };
    // }
  }
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
      break;
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
}

function handleStartChallenge(sender_psid) {}

function handleStartPostback(sender_psid) {
  const payload = {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text:
          "Nice, I am sure you are having a great day. What would you like to do? Be funky or daring ;)",
        buttons: [
          {
            type: "web_url",
            url: "https://jolly-mcclintock-06e37b.netlify.app/",
            title: "Challenge a friend",
            webview_height_ratio: "tall",
          },
          {
            type: "web_url",
            url: "https://jolly-mcclintock-06e37b.netlify.app/",
            title: "Browse challenges",
            webview_height_ratio: "tall",
          },
          {
            type: "web_url",
            url: "https://jolly-mcclintock-06e37b.netlify.app/",
            title: "Start a challenge",
            webview_height_ratio: "tall",
          },
        ],
      },
    },
  };
  callSendAPI(sender_psid, payload);
}

function handleLaterPostback(sender_psid) {
  const noPayload = {
    text: "That's ok my friend! Do you wanna get to know more about DanceTown?",
    quick_replies: [
      {
        content_type: "text",
        title: "Yessss",
        payload: "KNOW_MORE",
      },
    ],
  };
  callSendAPI(sender_psid, noPayload);
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
            payload: "START_DANCETOWN",
          },
          {
            content_type: "text",
            title: "No, maybe later",
            payload: "LATER_DANCETOWN",
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
