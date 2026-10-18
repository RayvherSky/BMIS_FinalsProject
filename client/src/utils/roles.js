export const normalizeRole = role => role === 'resident' ? 'user' : ['admin', 'employee', 'user'].includes(role) ? role : null;
export const getHomePath = role => ({ admin: '/admin/dashboard', employee: '/employee/assigned-tickets', user: '/user/dashboard' })[normalizeRole(role)] || '/login';
export const getTicketBasePath = role => ({ admin: '/admin', employee: '/employee', user: '/user' })[normalizeRole(role)] || null;
export const getRoleLabel = role => ({ admin: 'Admin', employee: 'Employee', user: 'User' })[normalizeRole(role)] || 'Unknown';
export const ROLE_OPTIONS = [{ value: 'admin', label: 'Admin' }, { value: 'employee', label: 'Employee' }, { value: 'user', label: 'User' }];
