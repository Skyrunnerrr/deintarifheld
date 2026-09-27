/**
 * Pure mail-header helpers shared by the send path and the customer shell.
 * Neither mail.js nor customer-mail.js should import the other.
 */

export function stripMailControls(value, max = 180) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
