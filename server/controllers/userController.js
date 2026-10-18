const User = require('../models/User');
const escapeSearch = require('../utils/escapeSearch');
const { isValidOptionalPhone, PHONE_MESSAGE } = require('../utils/validatePhone');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin)
const getAllUsers = async (req, res) => {
  try {
    const { search } = req.query;
    if (search !== undefined && typeof search !== 'string') {
      return res.status(400).json({ message: 'Search must be text' });
    }

    let filter = {};

    if (search) {
      filter.$or = [
        { firstName: { $regex: escapeSearch(search), $options: 'i' } },
        { lastName: { $regex: escapeSearch(search), $options: 'i' } },
        { email: { $regex: escapeSearch(search), $options: 'i' } },
      ];
    }

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private (Admin)
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update contact details (role changes use the dedicated endpoint)
// @route   PUT /api/users/:id
// @access  Private (Admin)
const updateUser = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address } = req.body;

    if (Object.prototype.hasOwnProperty.call(req.body, 'role')) {
      return res.status(400).json({ message: 'Use the separate Change Role action to update permissions' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!isValidOptionalPhone(phone)) {
      return res.status(400).json({ message: PHONE_MESSAGE });
    }

    // Check if email is being changed and if it's already taken
    if (email && email.toLowerCase() !== user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;

    // Use save with validateBeforeSave to skip password re-hashing
    // since password is not modified, the pre-save hook won't hash it again
    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');

    res.status(200).json(updatedUser);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Change a user's role after explicit account confirmation
// @route   PATCH /api/users/:id/role
// @access  Private (Admin)
const changeUserRole = async (req, res) => {
  try {
    const { role, confirmationEmail } = req.body;
    if (!['admin', 'resident'].includes(role)) {
      return res.status(400).json({ message: 'Choose either Admin or Resident' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (typeof confirmationEmail !== 'string' || confirmationEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      return res.status(400).json({ message: 'Enter the account email to confirm this role change' });
    }

    user.role = role;
    await user.save();
    const updatedUser = await User.findById(user._id).select('-password');
    res.status(200).json(updatedUser);
  } catch (error) {
    if (error.kind === 'ObjectId') return res.status(404).json({ message: 'User not found' });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  changeUserRole,
};
