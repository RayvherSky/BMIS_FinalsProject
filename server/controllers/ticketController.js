const Ticket = require("../models/Ticket");
const escapeSearch = require("../utils/escapeSearch");

const User = require('../models/User');
const { canonicalRole } = require('../utils/roles');
const { populateTicket, serializeTicket, canRead } = require('../utils/ticketAccess');
const { withAccountLock } = require('../utils/accountLock');

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

    res.status(201).json(serializeTicket(populatedTicket, { ...req.user, role: 'user' }));
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
    if ([category, status, priority, search].some(value => value !== undefined && typeof value !== 'string')) {
      return res.status(400).json({ message: "Search must be text" });
    }
    const actor = req.user || { role: 'admin' };
    const filter = { isArchived: false };
    if (canonicalRole(actor.role) === 'employee') {
      filter.assignedTo = actor.id;
      filter.isArchived = { $ne: true };
    }

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: escapeSearch(search), $options: "i" } },
        { description: { $regex: escapeSearch(search), $options: "i" } },
      ];
      if (canonicalRole(actor.role) === 'employee' && /^[a-f\d]{24}$/i.test(search)) {
        filter.$or.push({ _id: search });
      }
    }

    const tickets = await populateTicket(Ticket.find(filter), actor.role).sort({ createdAt: -1 });
    res.status(200).json(tickets.map(ticket => serializeTicket(ticket, actor)));
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
    if ([category, status, priority, search].some(value => value !== undefined && typeof value !== 'string')) {
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

    const actor = { ...req.user, role: req.user.role || 'user' };
    const tickets = await populateTicket(Ticket.find(filter), actor.role).sort({ createdAt: -1 });
    res.status(200).json(tickets.map(ticket => serializeTicket(ticket, actor)));
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get single ticket by ID
// @route   GET /api/tickets/:id
// @access  Private
const getTicketById = async (req, res) => {
  try {
    const ticket = await populateTicket(Ticket.findById(req.params.id), req.user.role);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    if (!canRead(ticket, req.user)) return res.status(403).json({ message: "Not authorized to view this ticket" });
    res.status(200).json(serializeTicket(ticket, req.user));
  } catch (error) {
    if (error.kind === "ObjectId") return res.status(404).json({ message: "Ticket not found" });
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

    const updatedTicket = await populateTicket(Ticket.findById(ticket._id), 'admin');

    res.status(200).json(serializeTicket(updatedTicket, req.user));
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

    const updatedTicket = await populateTicket(Ticket.findById(ticket._id), 'admin');

    res.status(200).json(serializeTicket(updatedTicket, req.user));
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

    if ([ticket, targetTicket].some(item => item.status === "Resolved" || item.isArchived)) {
      return res.status(400).json({ message: "Resolved or archived tickets cannot be linked" });
    }

    ticket.linkedTicket = linkedTicketId;
    await ticket.save();

    const updatedTicket = await populateTicket(Ticket.findById(ticket._id), 'admin');

    res.status(200).json(serializeTicket(updatedTicket, req.user));
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

    const updatedTicket = await populateTicket(Ticket.findById(ticket._id), 'admin');

    res.status(200).json(serializeTicket(updatedTicket, req.user));
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
    if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ message: "Note text is required" });
    const actor = { ...req.user, role: canonicalRole(req.user.role) };
    if (!['admin', 'employee', 'user'].includes(actor.role)) return res.status(403).json({ message: 'Not authorized' });
    const work = async () => {
      if (actor.role === 'employee') {
        // Recheck account eligibility after obtaining the transition lock. An old
        // protected request must not bypass a completed demotion/deactivation.
        const account = await User.findById(actor.id).select('role isActive');
        if (!account || account.role !== 'employee' || account.isActive === false) return res.status(403).json({ message: 'Employee access is no longer available' });
      }
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!canRead(ticket, actor)) return res.status(403).json({ message: "Not authorized to modify this ticket" });
      const privateNote = actor.role !== 'user' && Boolean(isPrivate);
      const note = { text: text.trim(), addedBy: actor.id, isPrivate: privateNote, authorRole: actor.role,
        kind: privateNote ? 'internal' : actor.role === 'user' ? 'reply' : 'update' };
      if (actor.role === 'employee') {
        // Assignment and archival state are mandatory predicates of the write.
        const updated = await Ticket.findOneAndUpdate(
          { _id: ticket._id, assignedTo: actor.id, isArchived: { $ne: true } },
          { $push: { notes: note } }, { new: true, runValidators: true });
        if (!updated) return res.status(403).json({ message: 'Assignment changed; refresh your queue' });
      } else {
        ticket.notes.push(note);
        await ticket.save();
      }
      const updatedTicket = await populateTicket(Ticket.findById(ticket._id), actor.role);
      if (!updatedTicket || !canRead(updatedTicket, actor)) return res.status(403).json({ message: 'Assignment changed; refresh your queue' });
      res.status(200).json(serializeTicket(updatedTicket, actor));
    };
    if (actor.role === 'employee') await withAccountLock(actor.id, work);
    else await work();
  } catch (error) {
    if (error.kind === "ObjectId") return res.status(404).json({ message: "Ticket not found" });
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
