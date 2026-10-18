const PHONE_MESSAGE = 'Enter a mobile number as 09XXXXXXXXX or +639XXXXXXXXX (spaces and hyphens allowed), or leave blank.';

function isValidOptionalPhone(value) {
  if (value === undefined) return true;
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text === '' || /^(?:09\d{9}|\+639\d{9})$/.test(text.replace(/[ -]/g, ''));
}

module.exports = { isValidOptionalPhone, PHONE_MESSAGE };
