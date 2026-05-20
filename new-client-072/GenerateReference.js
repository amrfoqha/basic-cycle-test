/**
 * Generate a short, human-friendly unique reference ID.
 * Format: PREFIX-YYYYMMDD-HHMMSS-XXXX where XXXX is a random alphanumeric suffix.
 * Example: ORD-20260520-153045-A1B2
 *
 * @param {Object} [opts]
 * @param {string} [opts.prefix] - Prefix for the reference (default: 'REF')
 * @param {number} [opts.suffixLength] - Length of random suffix (default: 4)
 * @returns {string} unique reference string
 */
function generateReference(opts = {}) {
  const { prefix = "REF", suffixLength = 4 } = opts;

  const pad = (n, width = 2) => String(n).padStart(width, "0");
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  const timestamp = `${yyyy}${mm}${dd}-${hh}${min}${ss}`;

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < Math.max(1, Math.floor(suffixLength)); i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${timestamp}-${suffix}`;
}

module.exports = { generateReference };

// Example usage:
// const { generateReference } = require('./GenerateReference');
// console.log(generateReference({ prefix: 'ORD', suffixLength: 4 }));
