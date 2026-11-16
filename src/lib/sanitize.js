'use strict';
// Injection-safe text for anything embedded in model context.
// Angle brackets are escaped so a skill name or description cannot close the
// routing wrapper; control characters are stripped and length is capped.

function sanitize(value, maxLen = 160) {
  let text = String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, ch => (ch === '<' ? '&lt;' : '&gt;'))
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLen > 0 && text.length > maxLen) text = text.slice(0, maxLen) + '…';
  return text;
}

module.exports = { sanitize };
