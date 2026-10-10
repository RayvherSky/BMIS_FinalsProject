const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUser,
} = require('../controllers/userController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

// All routes require admin access
router.get('/', protect, authorize('admin'), getAllUsers);
router.get('/:id', protect, authorize('admin'), getUserById);
router.put('/:id', protect, authorize('admin'), updateUser);

module.exports = router;
