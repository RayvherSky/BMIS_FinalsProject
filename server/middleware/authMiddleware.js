const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { canonicalRole, knownRole } = require('../utils/roles');

const protect = async (req, res, next) => {
  let decoded;
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    const token = authHeader.split(' ')[1];

    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }

  try {
    // User management changes must apply to existing sessions immediately.
    const user = await User.findById(decoded.id).select('_id role isActive');
    if (!user) return res.status(401).json({ message: 'Not authorized, user no longer exists' });
    if (user.isActive === false) return res.status(401).json({ message: 'This account is inactive' });
    if (!knownRole(user.role)) return res.status(403).json({ message: 'Account role is not authorized' });
    req.user = { id: user._id.toString(), role: canonicalRole(user.role) };
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = protect;
