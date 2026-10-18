const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: String,
  events: [{ _id: mongoose.Schema.Types.ObjectId, at: Date }],
  touchedAt: { type: Date, expires: 1200 },
});
module.exports = mongoose.model('CommunicationQuota', schema);
