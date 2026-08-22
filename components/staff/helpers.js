/** Small display helpers shared by the staff shell screens. */

export const initialsOf = (name, fallback = 'S') =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || fallback;

export const prettyRole = (userType, fallback = 'Staff') =>
  String(userType || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || fallback;
