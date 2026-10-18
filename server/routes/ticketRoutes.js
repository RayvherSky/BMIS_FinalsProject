const express = require("express");
const router = express.Router();
const {
  createTicket,
  getAllTickets,
  getMyTickets,
  getTicketById,
  updateTicketStatus,
  linkTicket,
  updateTicketPriority,
  unlinkTicket,
  addTicketNote,
} = require("../controllers/ticketController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { assignTicket } = require('../controllers/assignmentController');

// Resident creates ticket with optional image upload
router.post("/", protect, authorize("user"), upload, createTicket);

// Admin gets all tickets
router.get("/", protect, authorize("admin", "employee"), getAllTickets);

// Any authenticated user gets their own tickets
router.get("/my-tickets", protect, authorize("admin", "user"), getMyTickets);

// Any authenticated user gets a ticket by ID
router.get("/:id", protect, getTicketById);

// Any authenticated user can add a note
router.post("/:id/notes", protect, addTicketNote);
router.patch('/:id/assign', protect, authorize('admin'), assignTicket);

// Admin updates ticket status
router.put("/:id/status", protect, authorize("admin"), updateTicketStatus);

// Admin links a ticket to another
router.put("/:id/link", protect, authorize("admin"), linkTicket);

// Admin unlinks a ticket
router.put("/:id/unlink", protect, authorize("admin"), unlinkTicket);

// Admin updates ticket priority
router.patch(
  "/:id/priority",
  protect,
  authorize("admin"),
  updateTicketPriority,
);

module.exports = router;
