const mongoose = require('mongoose');
const ref = () => ({ type: mongoose.Schema.Types.ObjectId, ref: 'User' });
const historySchema = new mongoose.Schema({
  from: String, to: String, kind: { type: String, enum: ['status', 'assignment', 'reversal', 'legacy_correction'] },
  changedBy: ref(), reason: String, createdAt: { type: Date, default: Date.now },
  previousEvent: mongoose.Schema.Types.ObjectId,
  previousResolvedAt: Date, previousDismissedAt: Date, previousArchivedAt: Date, previousIsArchived: Boolean,
});
const requestSchema = new mongoose.Schema({
  type: { type: String, enum: ['follow_up', 'progress_update', 'appeal'], required: true },
  requestedBy: ref(), message: { type: String, default: '' }, day: String, dismissalKey: String,
  state: { type: String, enum: ['pending', 'acknowledged', 'completed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }, acknowledgedAt: Date, completedAt: Date,
  handledBy: ref(), responseText: String, responseNote: mongoose.Schema.Types.ObjectId,
  decision: { type: String, enum: ['accepted', 'rejected'] }, decisionReason: String,
  viewedBy: [{ user: ref(), at: Date, _id: false }],
  history: [{ action: String, actor: ref(), createdAt: Date, _id: false }],
});
module.exports = { historySchema, requestSchema };
