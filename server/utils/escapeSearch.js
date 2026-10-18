// User search terms are literal text, never regular-expression syntax.
module.exports = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
