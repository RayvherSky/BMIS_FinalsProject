export const PHONE_HELP = 'Optional: 09XXXXXXXXX or +639XXXXXXXXX; spaces and hyphens allowed.';
export const PHONE_MESSAGE = 'Enter a mobile number as 09XXXXXXXXX or +639XXXXXXXXX (spaces and hyphens allowed), or leave blank.';
export const REQUIRED_PHONE_HELP = 'Required: 09XXXXXXXXX or +639XXXXXXXXX; spaces and hyphens allowed.';
export function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const phone = value.trim().replace(/[ -]/g, '');
  if (/^09\d{9}$/.test(phone)) return phone;
  return /^\+639\d{9}$/.test(phone) ? `0${phone.slice(3)}` : null;
}

export function isValidOptionalPhone(value) {
  if (value === undefined) return true;
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text === '' || /^(?:09\d{9}|\+639\d{9})$/.test(text.replace(/[ -]/g, ''));
}

export const phoneRules = [{
  validator: (_, value) => isValidOptionalPhone(value)
    ? Promise.resolve()
    : Promise.reject(new Error(PHONE_MESSAGE)),
}];
export const requiredPhoneRules = [{ required: true, whitespace: true, message: 'Please enter a contact number' }, ...phoneRules];

// An edit may preserve a legacy value; changed values still use the current rule.
export const phoneRulesFor = (storedPhone) => [{
  validator: (_, value) => value === storedPhone
    ? Promise.resolve()
    : normalizePhone(storedPhone) && (value === undefined || (typeof value === 'string' && !value.trim()))
      ? Promise.reject(new Error('Please enter a contact number'))
      : phoneRules[0].validator(_, value),
}];
