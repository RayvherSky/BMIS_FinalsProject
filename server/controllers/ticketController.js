const Ticket = require("../models/Ticket");
const escapeSearch = require("../utils/escapeSearch");

const User = require('../models/User');
const { canonicalRole } = require('../utils/roles');
const { populateTicket, serializeTicket, canRead } = require('../utils/ticketAccess');
const { withAccountLock, withTicketLock } = require('../utils/accountLock');
const { problem, textInput, predicate, statusEvent, currentActor, sendProblem } = require('../utils/ticketLifecycle');
const { reserve, checkNote } = require('../utils/communicationLimits');
const { normalizePhone, REQUIRED_PHONE_MESSAGE } = require('../utils/validatePhone');
const { pendingReview, assignmentGuard, markReviewed, invalidateReview, mergeReviewUpdate } = require('../utils/reviewPolicy');
const { resolveLinkedTickets } = require('../utils/linkedTicketResolution');

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

    const suppliedContact = Object.prototype.hasOwnProperty.call(req.body, 'contactNumber');
    const account = suppliedContact ? null : await User.findById(req.user.id).select('phone');
    const contactNumber = normalizePhone(suppliedContact ? req.body.contactNumber : account?.phone);
    if (!contactNumber) return res.status(400).json({ message: REQUIRED_PHONE_MESSAGE });

    const ticketData = {
      title,
      description,
      category,
      customCategory: category === "Others" ? customCategory.trim() : "",
      // Residents report the situation; admins assess and change its priority.
      priority: "Medium",
      location,
      contactNumber,
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
    if (req.query.archived !== undefined) {
      if (req.query.archived !== 'dismissed') return res.status(400).json({ message: 'Invalid archive filter' });
      filter.isArchived = true;
      filter.status = 'Dismissed';
      if (status && status !== 'Dismissed') return res.status(400).json({ message: 'This view contains archived Dismissed reports only' });
    }

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

    // Serialize overlapping group resolutions before taking individual ticket
    // locks, so two Admins resolving different members cannot deadlock.
    const withResolutionLock = work => status === 'Resolved' ? withTicketLock('linked-resolution', work) : work();
    await withAccountLock(req.user.id, () => withResolutionLock(() => withTicketLock(req.params.id, async () => {
      await currentActor(req.user);
      const current = await Ticket.findById(req.params.id);
      if (!current) throw problem(404, 'Ticket not found');
      const previousStatus = current.status;
      if (status !== previousStatus && (status === 'Pending' || ['Resolved', 'Dismissed'].includes(previousStatus))) {
        throw problem(409, 'Use Revert Status with a reason to reopen or move this ticket backward.');
      }
      const now = new Date();
      const update = { $set: { status }, $inc: { workflowVersion: 1 } };
      if (status === 'Resolved' && previousStatus !== 'Resolved' && current.assignedTo) {
        if (!pendingReview(current)) throw problem(409, 'An Employee must request review before an Admin can resolve this assigned ticket.');
        mergeReviewUpdate(update, markReviewed(current, req.user, now, 'resolution'));
      }
      if (status === 'Dismissed' && previousStatus !== 'Dismissed') mergeReviewUpdate(update, invalidateReview(current, req.user, now, 'dismissal'));
      if (status !== previousStatus) update.$push = { ...update.$push, statusHistory: statusEvent(current, status, req.user, 'status', '', now) };
      if (status === 'Resolved') Object.assign(update.$set, {
        resolvedAt: previousStatus === 'Resolved' && current.resolvedAt ? current.resolvedAt : now,
        dismissedAt: null, isArchived: true, archivedAt: current.isArchived && current.archivedAt ? current.archivedAt : now,
      });
      else if (status === 'Dismissed') Object.assign(update.$set, { dismissedAt: previousStatus === 'Dismissed' && current.dismissedAt ? current.dismissedAt : now, resolvedAt: null });
      const updated = await Ticket.findOneAndUpdate(predicate(current, assignmentGuard(current)), update, { new: true, runValidators: true });
      if (!updated) throw problem(409, 'Ticket changed. Refresh and retry the status change.');
      if (status === 'Resolved') await resolveLinkedTickets(updated, req.user, now);
      const result = await populateTicket(Ticket.findById(current._id), 'admin');
      res.status(200).json(serializeTicket(result, req.user));
    })));
  } catch (error) {
    if (error.kind === "ObjectId")
      return res.status(404).json({ message: "Ticket not found" });
    sendProblem(res, error);
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
    const content = textInput(text, 'Note');
    const actor = { ...req.user, role: canonicalRole(req.user.role) };
    if (!['admin', 'employee', 'user'].includes(actor.role)) return res.status(403).json({ message: 'Not authorized' });
    const work = () => withTicketLock(req.params.id, async () => {
      await currentActor(actor);
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!canRead(ticket, actor)) return res.status(403).json({ message: "Not authorized to modify this ticket" });
      const privateNote = actor.role !== 'user' && Boolean(isPrivate);
      const now = new Date();
      const completesReview = actor.role === 'admin' && !privateNote && Boolean(ticket.assignedTo);
      if (completesReview && !pendingReview(ticket)) throw problem(409, 'An Employee must request review before an Admin can post a public update on this assigned ticket.');
      checkNote(ticket, actor, content, privateNote, now);
      const note = { text: content, addedBy: actor.id, isPrivate: privateNote, authorRole: actor.role, createdAt: now,
        kind: privateNote ? 'internal' : actor.role === 'user' ? 'reply' : 'update' };
      const extra = actor.role === 'employee' ? { assignedTo: actor.id, isArchived: { $ne: true } } : actor.role === 'user' ? { submittedBy: actor.id } : {};
      const update = { $push: { notes: note }, $inc: { workflowVersion: 1 } };
      if (completesReview) mergeReviewUpdate(update, markReviewed(ticket, actor, now, 'public_update'));
      const release = await reserve(actor, now);
      try {
        const updated = await Ticket.findOneAndUpdate(
          predicate(ticket, { ...assignmentGuard(ticket), ...extra }), update, { new: true, runValidators: true });
        if (!updated) throw problem(actor.role === 'employee' ? 403 : 409, 'Ticket access or content changed; refresh and retry.');
      } catch (error) { await release(); throw error; }
      const updatedTicket = await populateTicket(Ticket.findById(ticket._id), actor.role);
      if (!updatedTicket || !canRead(updatedTicket, actor)) return res.status(403).json({ message: 'Assignment changed; refresh your queue' });
      res.status(200).json(serializeTicket(updatedTicket, actor));
    });
    await withAccountLock(actor.id, work);
  } catch (error) {
    if (error.kind === "ObjectId") return res.status(404).json({ message: "Ticket not found" });
    sendProblem(res, error);
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
