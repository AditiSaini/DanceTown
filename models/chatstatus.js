var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var ChatStatusSchema = new Schema({
  user_id: { type: String, unique: true },
  preference: String,
  status: String,
});

module.exports = mongoose.model("ChatStatus", ChatStatusSchema);
