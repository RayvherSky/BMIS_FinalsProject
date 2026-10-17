const Ticket = require("../models/Ticket");

// @desc    Create a new ticket
// @route   POST /api/tickets
// @access  Private (Resident)
const createTicket = async (req, res) => {
  try {
    const { title, description, category, priority, location } = req.body;

    if (!title || !description || !category || !location) {
      return res
        .status(400)
        .json({
          message: "Please provide title, description, category, and location",
        });
    }

    const ticketData = {
      title,
      description,
      category,
      priority: priority || "Medium",
      location,
      submittedBy: req.user.id,
    };

    // If file was uploaded, set image path
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

    const filter = { isArchived: false };

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
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

    const filter = {
      submittedBy: req.user.id,
      isArchived: false,
    };

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
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

// @desc    Get single ticket by ID
// @route   GET /api/tickets/:id
// @access  Private
const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("submittedBy", "firstName lastName email")
      .populate({
        path: "linkedTicket",
        select:
          req.user.role === "resident" ? "_id title submittedBy" : undefined,
      });

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // If resident, verify they own the ticket
    if (
      req.user.role === "resident" &&
      ticket.submittedBy._id.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this ticket" });
    }

    // Keep duplicate navigation without exposing another resident's report.
    if (req.user.role === "resident" && ticket.linkedTicket) {
      const ownLinkedTicket =
        ticket.linkedTicket.submittedBy.toString() === req.user.id;
      const result = ticket.toObject();
      result.linkedTicket = ownLinkedTicket
        ? { _id: ticket.linkedTicket._id, title: ticket.linkedTicket.title }
        : { _id: ticket.linkedTicket._id };
      return res.status(200).json(result);
    }

    res.status(200).json(ticket);
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Ticket not found" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update ticket status (admin)
// @route   PUT /api/tickets/:id/status
// @access  Private (Admin)
const updateTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Please provide a status" });
    }

    const validStatuses = ["Pending", "In Progress", "Resolved", "Dismissed"];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const previousStatus = ticket.status;
    ticket.status = status;

    // Set or clear timestamps based on status transitions
    if (status === "Resolved") {
      ticket.resolvedAt = Date.now();
      ticket.dismissedAt = null;
    } else if (status === "Dismissed") {
      ticket.dismissedAt = Date.now();
      ticket.resolvedAt = null;
    } else {
      // Reverting from Resolved or Dismissed
      if (previousStatus === "Resolved" || previousStatus === "Dismissed") {
        ticket.resolvedAt = null;
        ticket.dismissedAt = null;
      }
    }

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("submittedBy", "firstName lastName email")
      .populate("linkedTicket");

    res.status(200).json(updatedTicket);
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Ticket not found" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ADDED NEW FEATURE CONTROLLER
// @desc    Update ticket priority (admin)
// @route   PATCH /api/tickets/:id/priority
// @access  Private (Admin)
const updateTicketPriority = async (req, res) => {
  try {
    const { priority } = req.body;

    if (!priority) {
      return res
        .status(400)
        .json({ message: "Please provide a priority level" });
    }

    const validPriorities = ["Low", "Medium", "High", "Critical"];
    if (!validPriorities.includes(priority)) {
      return res
        .status(400)
        .json({
          message: `Invalid priority. Must be one of: ${validPriorities.join(", ")}`,
        });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    ticket.priority = priority;
    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("submittedBy", "firstName lastName email")
      .populate("linkedTicket");

    res.status(200).json(updatedTicket);
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Ticket not found" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Link a ticket to another ticket (admin)
// @route   PUT /api/tickets/:id/link
// @access  Private (Admin)
const linkTicket = async (req, res) => {
  try {
    const { linkedTicketId } = req.body;

    if (!linkedTicketId) {
      return res.status(400).json({ message: "Please provide linkedTicketId" });
    }

    // Validate both tickets exist
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const targetTicket = await Ticket.findById(linkedTicketId);
    if (!targetTicket) {
      return res.status(404).json({ message: "Linked ticket not found" });
    }

    // Prevent linking to itself
    if (req.params.id === linkedTicketId) {
      return res
        .status(400)
        .json({ message: "Cannot link a ticket to itself" });
    }

    ticket.linkedTicket = linkedTicketId;
    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("submittedBy", "firstName lastName email")
      .populate("linkedTicket");

    res.status(200).json(updatedTicket);
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Ticket not found" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ADDED: updateTicketPriority to the exports
module.exports = {
  createTicket,
  getAllTickets,
  getMyTickets,
  getTicketById,
  updateTicketStatus,
  updateTicketPriority, // Exported here
  linkTicket,
};
