const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function dateText(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day} ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

// A transposed pair counts as one typo, along with insertion/deletion/replacement.
function distance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

export function filterTickets(tickets, query = '', fuzzy = false) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return tickets;
  return tickets.filter(ticket => {
    const owner = ticket.submittedBy;
    // Only searchable ticket fields: never internal notes or linked-report contents.
    const text = normalize([
      ticket.title, ticket.description, owner?.firstName, owner?.lastName, owner?.email,
      ticket.category, ticket.customCategory, ticket.status, ticket.priority, ticket.location,
      dateText(ticket.createdAt), dateText(ticket.archivedAt || (ticket.isArchived ? ticket.updatedAt : null)), dateText(ticket.resolvedAt), dateText(ticket.dismissedAt),
    ].filter(Boolean).join(' '));
    const words = fuzzy ? text.split(/[^a-z]+/).filter(Boolean) : [];
    return terms.every(term => {
      if (text.includes(term)) return true;
      if (!fuzzy || !/^[a-z]{4,40}$/.test(term)) return false;
      const limit = term.length >= 8 ? 2 : 1;
      return words.some(word => Math.abs(word.length - term.length) <= limit && distance(term, word) <= limit);
    });
  });
}
