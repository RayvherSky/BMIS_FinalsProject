const User = require('../models/User');
const { canonicalRole, safeUser } = require('../utils/roles');
const { withAccountLock } = require('../utils/accountLock');
const { clearAssignments } = require('../utils/assignmentLifecycle');
const escapeSearch = require('../utils/escapeSearch');
const { normalizePhone } = require('../utils/validatePhone');
const { prepareContactUpdate, accountFailure } = require('../utils/accountContacts');

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
        { phone: { $regex: escapeSearch(search), $options: 'i' } },
      ];
    }

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });

    res.status(200).json(users.map(safeUser));
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

    res.status(200).json(safeUser(user));
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
    const { firstName, lastName, address } = req.body;

    if (Object.prototype.hasOwnProperty.call(req.body, 'isActive')) {
      return res.status(400).json({ message: 'Use the separate account status action' });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'role')) {
      return res.status(400).json({ message: 'Use the separate Change Role action to update permissions' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const contacts = await prepareContactUpdate(user, req.body);

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    Object.assign(user, contacts);
    if (address !== undefined) user.address = address;

    // Use save with validateBeforeSave to skip password re-hashing
    // since password is not modified, the pre-save hook won't hash it again
    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');

    res.status(200).json(safeUser(updatedUser));
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    accountFailure(res, error);
  }
};

// @desc    Change a user's role after explicit account confirmation
// @route   PATCH /api/users/:id/role
// @access  Private (Admin)
const changeUserRole = async (req, res) => {
  try {
    const role = canonicalRole(req.body.role);
    if (!['admin', 'employee', 'user'].includes(role)) {
      return res.status(400).json({ message: 'Choose Admin, Employee or User' });
    }
    await withAccountLock(req.params.id, async () => {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (!confirmed(req.body.confirmationIdentifier ?? req.body.confirmationEmail, user)) {
        return res.status(400).json({ message: `Enter the account ${user.email ? 'email' : 'phone number'} to confirm this role change` });
      }
      if (user.role === 'employee' && role !== 'employee') {
        await clearAssignments(user._id, req.user.id, `Account role changed to ${role}`);
      }
      user.role = role;
      await user.save();
      res.status(200).json(safeUser(user));
    });
  } catch (error) { accountError(res, error); }
};

function confirmed(identifier, user) {
  if (typeof identifier !== 'string') return false;
  if (user.email) return identifier.trim().toLowerCase() === user.email.toLowerCase();
  const phone = normalizePhone(user.phone);
  return !!phone && normalizePhone(identifier) === phone;
}
function accountError(res, error) {
  if (error.kind === 'ObjectId') return res.status(404).json({ message: 'User not found' });
  res.status(500).json({ message: 'Account update failed', error: error.message });
}

const changeUserActive = async (req, res) => {
  try {
    if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ message: 'isActive must be a boolean' });
    if (req.params.id.toLowerCase() === req.user.id && req.body.isActive === false) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }
    await withAccountLock(req.params.id, async () => {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (!confirmed(req.body.confirmationIdentifier ?? req.body.confirmationEmail, user)) return res.status(400).json({ message: `Enter the account ${user.email ? 'email' : 'phone number'} to confirm this status change` });
      if (!req.body.isActive) await clearAssignments(user._id, req.user.id, 'Account deactivated');
      user.isActive = req.body.isActive;
      await user.save();
      res.status(200).json(safeUser(user));
    });
  } catch (error) { accountError(res, error); }
};

const getEmployees = async (req, res) => {
  try {
    const users = await User.find({ role: 'employee', isActive: { $ne: false } })
      .select('_id firstName lastName email phone').sort({ firstName: 1, lastName: 1 });
    res.status(200).json(users.map(user => ({ _id: user._id, firstName: user.firstName, lastName: user.lastName, name: `${user.firstName} ${user.lastName}`, email: user.email, phone: user.phone })));
  } catch (error) { accountError(res, error); }
};

module.exports = { getAllUsers, getUserById, updateUser, changeUserRole, changeUserActive, getEmployees };
