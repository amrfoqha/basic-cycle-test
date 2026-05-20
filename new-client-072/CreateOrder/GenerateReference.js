/**
 * Generate a unique numeric reference string with at most 10 digits.
 * By default returns a 10-digit numeric string (digits only).
 * You can request a shorter length via `opts.length` (1..10).
 *
 * The implementation combines the current timestamp and a random component
 * and then takes the last `length` digits to provide a compact, time-ordered
 * and reasonably unique identifier.
 *
 * @param {Object} [opts]
 * @param {number} [opts.length=10] - Desired length in digits (max 10)
 * @returns {string} numeric reference (digits only)
 */
function generateReference(opts = {}) {
  const requested = Number.isInteger(opts.length) ? opts.length : 10;
  const length = Math.max(1, Math.min(10, requested));

  // Use timestamp in milliseconds + a random suffix to increase uniqueness
  const now = Date.now().toString(); // typically 13 digits
  const rand = Math.floor(Math.random() * 1e6).toString();
  const combined = now + rand;

  // Take the last `length` digits to form the reference
  let ref = combined.slice(-length);

  // If combined is shorter (very unlikely), pad with random digits
  if (ref.length < length) {
    let pad = "";
    while (pad.length < length - ref.length)
      pad += Math.floor(Math.random() * 10);
    ref = (pad + ref).slice(-length);
  }

  return ref;
}

module.exports = { generateReference };

// Example usage:
// const { generateReference } = require('./GenerateReference');
// console.log(generateReference({ length: 8 }));
