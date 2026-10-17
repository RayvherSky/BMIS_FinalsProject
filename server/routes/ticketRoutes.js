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

// Resident creates ticket with optional image upload
router.post("/", protect, authorize("resident"), upload, createTicket);

// Admin gets all tickets
router.get("/", protect, authorize("admin"), getAllTickets);

// Any authenticated user gets their own tickets
router.get("/my-tickets", protect, getMyTickets);

// Any authenticated user gets a ticket by ID
router.get("/:id", protect, getTicketById);

// Any authenticated user can add a note
router.post("/:id/notes", protect, addTicketNote);

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
