const Ticket = require("../models/Ticket");
const escapeSearch = require("../utils/escapeSearch");

// Sanitize a ticket for resident-facing responses:
// - Strip private notes.
// - Redact linked tickets: own → { _id, title }, foreign → { _id }.
// Accepts a Mongoose document or plain object; always returns a plain object.
function sanitizeForResident(ticketDocOrObj, userId) {
  const obj =
    typeof ticketDocOrObj.toObject === "function"
      ? ticketDocOrObj.toObject()
      : ticketDocOrObj;
  obj.notes = (obj.notes || []).filter((n) => !n.isPrivate);
  if (obj.linkedTicket && typeof obj.linkedTicket === "object" && obj.linkedTicket._id) {
    const linkedOwner = obj.linkedTicket.submittedBy;
    const ownLink =
      linkedOwner &&
      (typeof linkedOwner === "object"
        ? linkedOwner._id || linkedOwner
        : linkedOwner
      ).toString() === userId;
    obj.linkedTicket = ownLink
      ? { _id: obj.linkedTicket._id, title: obj.linkedTicket.title }
      : { _id: obj.linkedTicket._id };
  }
  return obj;
}

// @desc    Create a new ticket
// @route   POST /api/tickets
// @access  Private (Resident)
const createTicket = async (req, res) => {
  try {
    const { title, description, category, customCategory, location } =
      req.body;

    if (!title || !description || !category || !location) {
      return res
        .status(400)
        .json({
          message: "Please provide title, description, category, and location",
        });
    }

    if (category === "Others" && (typeof customCategory !== "string" || !customCategory.trim())) {
      return res.status(400).json({ message: "Please specify your custom category" });
    }

    const ticketData = {
      title,
      description,
      category,
      customCategory: category === "Others" ? customCategory.trim() : "",
      // Residents report the situation; admins assess and change its priority.
      priority: "Medium",
      location,
      submittedBy: req.user.id,
    };

    if (req.file) {
      ticketData.image = `/uploads/${req.file.filename}`;
    }

    const ticket = await Ticket.create(ticketData);

    const populatedTicket = await Ticket.findById(ticket._id).populate(
      "submittedBy",
      "firstName lastName email",
    );

    res.status(201).json(populatedTicket);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all tickets (admin)
// @route   GET /api/tickets
// @access  Private (Admin)
const getAllTickets = async (req, res) => {
  try {
    const { category, status, priority, search } = req.query;
    if (search !== undefined && typeof search !== "string") {
      return res.status(400).json({ message: "Search must be text" });
    }
    const filter = { isArchived: false };

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: escapeSearch(search), $options: "i" } },
        { description: { $regex: escapeSearch(search), $options: "i" } },
      ];
    }

    const tickets = await Ticket.find(filter)
      .populate("submittedBy", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json(tickets);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get my tickets (resident)
// @route   GET /api/tickets/my-tickets
// @access  Private
const getMyTickets = async (req, res) => {
  try {
    const { category, status, priority, search } = req.query;
    if (search !== undefined && typeof search !== "string") {
      return res.status(400).json({ message: "Search must be text" });
    }
    const filter = { submittedBy: req.user.id, isArchived: false };

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: escapeSearch(search), $options: "i" } },
        { description: { $regex: escapeSearch(search), $options: "i" } },
      ];
    }

    const tickets = await Ticket.find(filter)
      .populate("submittedBy", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json(tickets.map((t) => sanitizeForResident(t, req.user.id)));
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get single ticket by ID
// @route   GET /api/tickets/:id
// @access  Private
const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("submittedBy", "firstName lastName email")
      .populate("notes.addedBy", "firstName lastName role")
      .populate({
        path: "linkedTicket",
        select:
          req.user.role === "resident" ? "_id title submittedBy" : undefined,
      });

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (
      req.user.role === "resident" &&
      ticket.submittedBy._id.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this ticket" });
    }

    // Sanitize private notes and linked-ticket visibility for residents
    if (req.user.role === "resident") {
      return res.status(200).json(sanitizeForResident(ticket, req.user.id));
    }

    res.status(200).json(ticket);
  } catch (error) {
    if (error.kind === "ObjectId")
      return res.status(404).json({ message: "Ticket not found" });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update ticket status (admin)
// @route   PUT /api/tickets/:id/status
// @access  Private (Admin)
const updateTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status)
      return res.status(400).json({ message: "Please provide a status" });

    const validStatuses = ["Pending", "In Progress", "Resolved", "Dismissed"];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const previousStatus = ticket.status;
    ticket.status = status;

    if (status === "Resolved") {
      const completedAt = new Date();
      if (previousStatus !== "Resolved" || !ticket.resolvedAt) ticket.resolvedAt = completedAt;
      ticket.dismissedAt = null;
      if (!ticket.isArchived || !ticket.archivedAt) ticket.archivedAt = completedAt;
      ticket.isArchived = true;
    } else if (status === "Dismissed") {
      ticket.dismissedAt = Date.now();
      ticket.resolvedAt = null;
    } else {
      if (previousStatus === "Resolved" || previousStatus === "Dismissed") {
        ticket.resolvedAt = null;
        ticket.dismissedAt = null;
      }
    }

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("submittedBy", "firstName lastName email")
      .populate("notes.addedBy", "firstName lastName role")
      .populate("linkedTicket");

    res.status(200).json(updatedTicket);
  } catch (error) {
    if (error.kind === "ObjectId")
      return res.status(404).json({ message: "Ticket not found" });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update ticket priority (admin)
// @route   PATCH /api/tickets/:id/priority
// @access  Private (Admin)
const updateTicketPriority = async (req, res) => {
  try {
    const { priority } = req.body;
    if (!priority)
      return res
        .status(400)
        .json({ message: "Please provide a priority level" });

    const validPriorities = ["Low", "Medium", "High", "Urgent"];
    if (!validPriorities.includes(priority)) {
      return res
        .status(400)
        .json({
          message: `Invalid priority. Must be one of: ${validPriorities.join(", ")}`,
        });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    ticket.priority = priority;
    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("submittedBy", "firstName lastName email")
      .populate("notes.addedBy", "firstName lastName role")
      .populate("linkedTicket");

    res.status(200).json(updatedTicket);
  } catch (error) {
    if (error.kind === "ObjectId")
      return res.status(404).json({ message: "Ticket not found" });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Link a ticket to another ticket (admin)
// @route   PUT /api/tickets/:id/link
// @access  Private (Admin)
const linkTicket = async (req, res) => {
  try {
    const { linkedTicketId } = req.body;
    if (!linkedTicketId)
      return res.status(400).json({ message: "Please provide linkedTicketId" });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const targetTicket = await Ticket.findById(linkedTicketId);
    if (!targetTicket)
      return res.status(404).json({ message: "Linked ticket not found" });

    if (req.params.id === linkedTicketId) {
      return res
        .status(400)
        .json({ message: "Cannot link a ticket to itself" });
    }

    ticket.linkedTicket = linkedTicketId;
    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("submittedBy", "firstName lastName email")
      .populate("notes.addedBy", "firstName lastName role")
      .populate("linkedTicket");

    res.status(200).json(updatedTicket);
  } catch (error) {
    if (error.kind === "ObjectId")
      return res.status(404).json({ message: "Ticket not found" });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Unlink a ticket (admin)
// @route   PUT /api/tickets/:id/unlink
// @access  Private (Admin)
const unlinkTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    ticket.linkedTicket = null;
    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("submittedBy", "firstName lastName email")
      .populate("notes.addedBy", "firstName lastName role")
      .populate("linkedTicket");

    res.status(200).json(updatedTicket);
  } catch (error) {
    if (error.kind === "ObjectId")
      return res.status(404).json({ message: "Ticket not found" });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Add a note to ticket
// @route   POST /api/tickets/:id/notes
// @access  Private
const addTicketNote = async (req, res) => {
  try {
    const { text, isPrivate } = req.body;
    if (!text)
      return res.status(400).json({ message: "Note text is required" });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (
      req.user.role === "resident" &&
      ticket.submittedBy.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this ticket" });
    }

    const noteIsPrivate =
      req.user.role === "admin" ? Boolean(isPrivate) : false;

    ticket.notes.push({
      text,
      addedBy: req.user.id,
      isPrivate: noteIsPrivate,
    });

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("submittedBy", "firstName lastName email")
      .populate("notes.addedBy", "firstName lastName role")
      .populate("linkedTicket");

    res
      .status(200)
      .json(
        req.user.role === "resident"
          ? sanitizeForResident(updatedTicket, req.user.id)
          : updatedTicket,
      );
  } catch (error) {
    if (error.kind === "ObjectId")
      return res.status(404).json({ message: "Ticket not found" });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createTicket,
  getAllTickets,
  getMyTickets,
  getTicketById,
  updateTicketStatus,
  updateTicketPriority,
  linkTicket,
  unlinkTicket,
  addTicketNote,
};
