import { randomInt } from 'node:crypto';

// Accounts persist across scenarios in the shared isolated browser database.
// Generate a new valid identity for each registration, including worker restarts.
export const testPhone = () => `09${randomInt(100000000, 1000000000)}`;
