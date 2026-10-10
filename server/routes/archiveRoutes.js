const express = require('express');
const router = express.Router();
const {
  getArchivedTickets,
  archiveTicket,
  restoreTicket,
} = require('../controllers/archiveController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

// All routes require admin access
router.get('/', protect, authorize('admin'), getArchivedTickets);
router.put('/:id/archive', protect, authorize('admin'), archiveTicket);
router.put('/:id/restore', protect, authorize('admin'), restoreTicket);

module.exports = router;
