export const PHONE_HELP = 'Optional: 09XXXXXXXXX or +639XXXXXXXXX; spaces and hyphens allowed.';
export const PHONE_MESSAGE = 'Enter a mobile number as 09XXXXXXXXX or +639XXXXXXXXX (spaces and hyphens allowed), or leave blank.';

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

// An edit may preserve a legacy value; changed values still use the current rule.
export const phoneRulesFor = (storedPhone) => [{
  validator: (_, value) => value === storedPhone
    ? Promise.resolve()
    : phoneRules[0].validator(_, value),
}];
