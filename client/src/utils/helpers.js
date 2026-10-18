import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/**
 * Format a date string into a readable format.
 * @param {string|Date} date
 * @param {string} format - dayjs format string
 * @returns {string}
 */
export const formatDate = (date, format = 'MMM D, YYYY h:mm A') => {
  if (!date) return 'N/A';
  return dayjs(date).format(format);
};

/**
 * Get relative time from now (e.g., "2 hours ago").
 * @param {string|Date} date
 * @returns {string}
 */
export const timeAgo = (date) => {
  if (!date) return 'N/A';
  return dayjs(date).fromNow();
};

/**
 * Return a color string for a given priority level.
 * @param {string} priority
 * @returns {string}
 */
export const getPriorityColor = (priority) => {
  const colors = {
    Low: 'green',
    Medium: 'blue',
    High: 'orange',
    Urgent: 'red',
  };
  return colors[priority] || 'default';
};

/**
 * Return an appropriate Ant Design icon name string for each category.
 * @param {string} category
 * @returns {string}
 */
export const getCategoryIcon = (category) => {
  const icons = {
    Sanitation: 'DeleteOutlined',
    Infrastructure: 'ToolOutlined',
    Security: 'SafetyOutlined',
    'Noise Complaint': 'SoundOutlined',
    'Public Safety': 'WarningOutlined',
    'Environmental Hazard': 'CloudOutlined',
    Utilities: 'ThunderboltOutlined',
  };
  return icons[category] || 'InfoCircleOutlined';
};

/**
 * Return a color for each category tag.
 * @param {string} category
 * @returns {string}
 */
export const getCategoryColor = (category) => {
  const colors = {
    Sanitation: 'cyan',
    Infrastructure: 'blue',
    Security: 'purple',
    'Noise Complaint': 'magenta',
    'Public Safety': 'volcano',
    'Environmental Hazard': 'green',
    Utilities: 'orange',
  };
  return colors[category] || 'default';
};

/**
 * List of all ticket categories.
 */
export const CATEGORIES = [
  'Sanitation',
  'Infrastructure',
  'Security',
  'Noise Complaint',
  'Public Safety',
  'Environmental Hazard',
  'Utilities',
  'Others',
];

/**
 * List of all ticket statuses.
 */
export const STATUSES = ['Pending', 'In Progress', 'Resolved', 'Dismissed'];

/**
 * List of all priority levels.
 */
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
