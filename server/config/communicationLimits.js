// Approved starting policy. Environment values must be positive whole numbers.
const positive = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error(`${name} must be a positive integer`);
  return Number(value);
};
module.exports = {
  userNotesPerMinute: positive('BMIS_USER_NOTES_PER_MINUTE', 5),
  staffNotesPerMinute: positive('BMIS_STAFF_NOTES_PER_MINUTE', 20),
  userSubmissionsPerTenMinutes: positive('BMIS_USER_SUBMISSIONS_PER_TEN_MINUTES', 20),
  staffSubmissionsPerTenMinutes: positive('BMIS_STAFF_SUBMISSIONS_PER_TEN_MINUTES', 100),
  duplicateSeconds: positive('BMIS_DUPLICATE_NOTE_SECONDS', 60),
};
