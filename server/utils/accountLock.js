// Process-local serialization: assignment eligibility and account transitions use
// the same key. A ticket key also serializes concurrent assignment requests.
const pending = new Map();
async function withLock(key, work) {
  const previous = pending.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  pending.set(key, current);
  await previous;
  try { return await work(); }
  finally {
    release();
    if (pending.get(key) === current) pending.delete(key);
  }
}
module.exports = {
  withAccountLock: (id, work) => withLock(`account:${String(id).toLowerCase()}`, work),
  withTicketLock: (id, work) => withLock(`ticket:${String(id).toLowerCase()}`, work),
};
