const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { canonicalRole, knownRole, safeUser } = require('../utils/roles');
const { normalizePhone, REQUIRED_PHONE_MESSAGE } = require('../utils/validatePhone');
const { normalizeEmail, ensureAvailable, findByIdentifier, identifierFrom, prepareContactUpdate, accountFailure } = require('../utils/accountContacts');

// Helper: Generate JWT token
const generateToken = (id, role) => {
  return jwt.sign({ id, role: canonicalRole(role) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { firstName, lastName, password, address } = req.body;

    // Validate required fields
    if (typeof firstName !== 'string' || !firstName.trim() || typeof lastName !== 'string' || !lastName.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Please provide firstName, lastName, phone, and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const phone = normalizePhone(req.body.phone);
    if (!phone) return res.status(400).json({ message: REQUIRED_PHONE_MESSAGE });
    const email = normalizeEmail(req.body.email);
    await ensureAvailable({ email, phone });

    // Public registration always creates a standard User
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone: phone || '',
      address: address || '',
      role: 'user',
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: canonicalRole(user.role),
        isActive: user.isActive !== false,
        phone: user.phone,
        address: user.address,
      },
    });
  } catch (error) {
    accountFailure(res, error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { password } = req.body;
    const identifier = identifierFrom(req.body);

    if (typeof identifier !== 'string' || !identifier.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Please provide your phone number or email and password' });
    }

    const user = await findByIdentifier(identifier);
    if (!user || user.isActive === false || !knownRole(user.role)) {
      return res.status(401).json({ message: 'Invalid phone number, email or password' });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid phone number, email or password' });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: canonicalRole(user.role),
        isActive: user.isActive !== false,
        phone: user.phone,
        address: user.address,
      },
    });
  } catch (error) {
    accountFailure(res, error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(safeUser(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update own profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, address, password } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const contacts = await prepareContactUpdate(user, req.body);

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    Object.assign(user, contacts);
    if (address !== undefined) user.address = address;

    // Update password if provided
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      user.password = password;
    }

    await user.save();

    res.status(200).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: canonicalRole(user.role),
      isActive: user.isActive !== false,
      phone: user.phone,
      address: user.address,
    });
  } catch (error) {
    accountFailure(res, error);
  }
};

// @desc    Forgot password - generate reset token
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const user = await findByIdentifier(identifierFrom(req.body));
    if (!user) {
      return res.status(404).json({ message: 'No account found with that phone number or email' });
    }

    // Generate raw reset token
    const rawToken = crypto.randomBytes(20).toString('hex');

    // Hash token and save to user
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour

    await user.save({ validateBeforeSave: false });

    // Return raw token (localhost demo - no email sending)
    res.status(200).json({
      message: 'Demo password reset token generated; no email or SMS was sent',
      resetToken: rawToken,
    });
  } catch (error) {
    accountFailure(res, error);
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    if (!password) {
      return res.status(400).json({ message: 'Please provide a new password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Update password and clear reset fields
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
};
