const PHONE_MESSAGE = 'Enter a mobile number as 09XXXXXXXXX or +639XXXXXXXXX (spaces and hyphens allowed), or leave blank.';
const REQUIRED_PHONE_MESSAGE = 'Enter a valid mobile number as 09XXXXXXXXX or +639XXXXXXXXX (spaces and hyphens allowed).';

function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(/[ -]/g, '');
  if (!/^(?:09\d{9}|\+639\d{9})$/.test(compact)) return null;
  return compact.startsWith('+63') ? `0${compact.slice(3)}` : compact;
}

function isValidOptionalPhone(value) {
  if (value === undefined) return true;
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text === '' || /^(?:09\d{9}|\+639\d{9})$/.test(text.replace(/[ -]/g, ''));
}

module.exports = { isValidOptionalPhone, normalizePhone, PHONE_MESSAGE, REQUIRED_PHONE_MESSAGE };
