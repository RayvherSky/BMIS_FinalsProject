const Ticket = require('../models/Ticket');
const escapeSearch = require('../utils/escapeSearch');

// @desc    Get all archived tickets
// @route   GET /api/archive
// @access  Private (Admin)
const getArchivedTickets = async (req, res) => {
  try {
    const { category, status, priority, search } = req.query;
    if (search !== undefined && typeof search !== 'string') {
      return res.status(400).json({ message: 'Search must be text' });
    }

    const filter = { isArchived: true };

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    if (search) {
      filter.$or = [
        { title: { $regex: escapeSearch(search), $options: 'i' } },
        { description: { $regex: escapeSearch(search), $options: 'i' } },
      ];
    }

    const tickets = await Ticket.find(filter)
      .populate('submittedBy', 'firstName lastName email')
      .sort({ archivedAt: -1, updatedAt: -1 });

    res.status(200).json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Archive a ticket (only Resolved or Dismissed)
// @route   PUT /api/archive/:id/archive
// @access  Private (Admin)
const archiveTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Only allow archiving Resolved or Dismissed tickets
    if (ticket.status !== 'Resolved' && ticket.status !== 'Dismissed') {
      return res.status(400).json({
        message: 'Only Resolved or Dismissed tickets can be archived',
      });
    }

    if (ticket.isArchived) {
      return res.status(400).json({ message: 'Ticket is already archived' });
    }

    ticket.isArchived = true;
    ticket.archivedAt = new Date();
    await ticket.save();

    const archivedTicket = await Ticket.findById(ticket._id).populate(
      'submittedBy',
      'firstName lastName email'
    );

    res.status(200).json(archivedTicket);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Restore an archived ticket
// @route   PUT /api/archive/:id/restore
// @access  Private (Admin)
const restoreTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (!ticket.isArchived) {
      return res.status(400).json({ message: 'Ticket is not archived' });
    }

    ticket.isArchived = false;
    ticket.archivedAt = null;
    await ticket.save();

    const restoredTicket = await Ticket.findById(ticket._id).populate(
      'submittedBy',
      'firstName lastName email'
    );

    res.status(200).json(restoredTicket);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getArchivedTickets,
  archiveTicket,
  restoreTicket,
};
