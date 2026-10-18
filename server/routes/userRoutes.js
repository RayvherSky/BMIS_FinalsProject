const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUser,
  changeUserRole,
  changeUserActive,
  getEmployees,
} = require('../controllers/userController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

// All routes require admin access
router.get('/', protect, authorize('admin'), getAllUsers);
router.get('/employees', protect, authorize('admin'), getEmployees);
router.get('/:id', protect, authorize('admin'), getUserById);
router.put('/:id', protect, authorize('admin'), updateUser);
router.patch('/:id/role', protect, authorize('admin'), changeUserRole);
router.patch('/:id/active', protect, authorize('admin'), changeUserActive);

module.exports = router;
