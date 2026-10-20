const canonicalRole = role => role === 'resident' ? 'user' : role;
const knownRole = role => ['admin', 'employee', 'user'].includes(canonicalRole(role));

function safeUser(document) {
  if (!document) return document;
  const user = typeof document.toObject === 'function' ? document.toObject() : { ...document };
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  delete user.demoProvisioningKey;
  delete user.phoneNormalized;
  user.role = canonicalRole(user.role);
  user.isActive = user.isActive !== false;
  return user;
}

module.exports = { canonicalRole, knownRole, safeUser };
