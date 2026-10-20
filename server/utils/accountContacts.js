const User = require('../models/User');
const { normalizePhone, isValidOptionalPhone, REQUIRED_PHONE_MESSAGE } = require('./validatePhone');

const invalid = message => Object.assign(new Error(message), { status: 400 });
function normalizeEmail(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw invalid('Please provide a valid email or leave it blank');
  const email = value.trim().toLowerCase();
  if (!email) return undefined;
  if (!/^\S+@\S+\.\S+$/.test(email)) throw invalid('Please provide a valid email or leave it blank');
  return email;
}
function phoneFilter(phone) {
  const local = phone.split('').join('[ -]*');
  const international = `\\+[ -]*${(`63${phone.slice(1)}`).split('').join('[ -]*')}`;
  return { $or: [{ phoneNormalized: phone }, { phone: new RegExp(`^\\s*[ -]*(?:${local}|${international})[ -]*\\s*$`) }] };
}
async function ensureAvailable({ email, phone }, exceptId) {
  const exclude = exceptId ? { _id: { $ne: exceptId } } : {};
  if (email && await User.findOne({ ...exclude, email })) throw invalid('Email already registered');
  if (phone && await User.findOne({ ...exclude, ...phoneFilter(phone) })) throw invalid('Phone number already registered');
}
async function findByIdentifier(value) {
  if (typeof value !== 'string' || !value.trim()) throw invalid('Please provide your phone number or email');
  if (value.includes('@')) return User.findOne({ email: normalizeEmail(value) });
  const phone = normalizePhone(value);
  if (!phone) return null;
  // Historical duplicate phones are ambiguous; retain their separate email login.
  const matches = await User.find(phoneFilter(phone)).limit(2);
  return matches.length === 1 ? matches[0] : null;
}
function identifierFrom(body) {
  return body.identifier ?? body.email ?? body.phone;
}
async function prepareContactUpdate(user, body) {
  const changes = {};
  if (Object.prototype.hasOwnProperty.call(body, 'email')) changes.email = normalizeEmail(body.email);
  if (body.phone !== undefined && body.phone !== user.phone) {
    const normalized = normalizePhone(body.phone);
    if (!normalized && (normalizePhone(user.phone) || !isValidOptionalPhone(body.phone))) throw invalid(REQUIRED_PHONE_MESSAGE);
    changes.phone = normalized || '';
  }
  const email = Object.prototype.hasOwnProperty.call(changes, 'email') ? changes.email : user.email;
  const phone = Object.prototype.hasOwnProperty.call(changes, 'phone') ? changes.phone : user.phone;
  if (!email && !normalizePhone(phone)) throw invalid('Keep a valid phone number or email for signing in');
  // Removing email is safe only when the remaining phone can authenticate this
  // account unambiguously, including legacy contacts without a normalized key.
  if (Object.prototype.hasOwnProperty.call(changes, 'email') && !changes.email) {
    await ensureAvailable({ phone: normalizePhone(phone) }, user._id);
  }
  await ensureAvailable({ email: changes.email && changes.email !== user.email ? changes.email : undefined,
    phone: changes.phone && normalizePhone(changes.phone) !== normalizePhone(user.phone) ? changes.phone : undefined }, user._id);
  return changes;
}
function accountFailure(res, error, message = 'Server error') {
  if (error.code === 11000) return res.status(400).json({ message: error.keyPattern?.phoneNormalized ? 'Phone number already registered' : 'Email already registered' });
  if (error.status === 400 || error.name === 'ValidationError') return res.status(400).json({ message: error.message });
  return res.status(500).json({ message, error: error.message });
}

module.exports = { normalizeEmail, ensureAvailable, findByIdentifier, identifierFrom, prepareContactUpdate, accountFailure };
