const mongoose = require("mongoose");
const { historySchema, requestSchema } = require('./ticketWorkflowSchemas');

const ticketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "Sanitation",
        "Infrastructure",
        "Security",
        "Noise Complaint",
        "Public Safety",
        "Environmental Hazard",
        "Utilities",
        "Others",
      ],
    },
    customCategory: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved", "Dismissed"],
      default: "Pending",
    },
    workflowVersion: { type: Number, default: 0 },
    statusHistory: [historySchema],
    requests: [requestSchema],
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    location: {
      type: String,
      required: [true, "Location is required"],
    },
    image: {
      type: String,
      default: "",
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Submitted by is required"],
    },
    linkedTicket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      default: null,
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: null },
    assignmentHistory: [{
      previousEmployee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      newEmployee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now },
      action: { type: String, enum: ['assigned', 'reassigned', 'unassigned'], required: true },
      reason: String,
    }],
    notes: [
      {
        text: { type: String, required: true },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        isPrivate: { type: Boolean, default: false },
        kind: { type: String, enum: ['reply', 'update', 'internal'] },
        authorRole: { type: String, enum: ['admin', 'employee', 'user'] },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    dismissedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Ticket", ticketSchema);
