const mongoose = require('mongoose');
const userRef = { type: mongoose.Schema.Types.ObjectId, ref: 'User' };
const reviewSchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'reviewed'], required: true },
  requestedBy: userRef,
  requestedAt: { type: Date, required: true },
  reviewedBy: { ...userRef, default: null },
  reviewedAt: { type: Date, default: null },
  assignmentId: userRef,
  assignedAt: { type: Date, default: null },
}, { _id: false });
const reviewHistorySchema = new mongoose.Schema({
  action: { type: String, enum: ['requested', 'reviewed', 'invalidated'], required: true },
  actor: userRef,
  createdAt: { type: Date, required: true },
  requestedBy: userRef,
  requestedAt: Date,
  assignmentId: userRef,
  assignedAt: Date,
  source: String,
}, { _id: false });
module.exports = { reviewSchema, reviewHistorySchema };
