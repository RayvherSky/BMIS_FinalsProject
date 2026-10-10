const express = require('express');
const router = express.Router();
const {
  createTicket,
  getAllTickets,
  getMyTickets,
  getTicketById,
  updateTicketStatus,
  linkTicket,
} = require('../controllers/ticketController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Resident creates ticket with optional image upload
router.post('/', protect, authorize('resident'), upload, createTicket);

// Admin gets all tickets
router.get('/', protect, authorize('admin'), getAllTickets);

// Any authenticated user gets their own tickets
router.get('/my-tickets', protect, getMyTickets);

// Any authenticated user gets a ticket by ID (resident ownership checked in controller)
router.get('/:id', protect, getTicketById);

// Admin updates ticket status
router.put('/:id/status', protect, authorize('admin'), updateTicketStatus);

// Admin links a ticket to another
router.put('/:id/link', protect, authorize('admin'), linkTicket);

module.exports = router;
