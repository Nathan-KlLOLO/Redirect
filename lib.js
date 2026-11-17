// Pure functions only: importable by the browser (app.js) and by Node (tests).

const KEY_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// "constructor" is the only Object.prototype member name that matches KEY_RE
// (the others contain capitals or underscores), so it is rejected explicitly.
export function isValidProjectKey(s) {
  return typeof s === 'string' && KEY_RE.test(s) && s !== 'constructor';
}

function isPrivateIPv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

// Returns the normalised href if the target is a private-LAN http origin, else null.
export function isAllowedTarget(urlString) {
  if (typeof urlString !== 'string') return null;
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:') return null;
  if (u.username !== '' || u.password !== '') return null;
  if (!isPrivateIPv4(u.hostname)) return null;
  if (u.port !== '') {
    const p = Number(u.port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) return null;
  }
  if (u.pathname !== '/' || u.search !== '' || u.hash !== '') return null;
  // Rebuilt rather than u.href so a bare trailing "?" or "#" cannot survive.
  return `${u.protocol}//${u.host}/`;
}

export function resolveProject(targets, key, nowMs, maxAgeMs = DAY_MS) {
  if (!isValidProjectKey(key)) return { status: 'bad-key' };

  const projects = targets && targets.version === 1 ? targets.projects : null;
  if (!projects || typeof projects !== 'object' || Array.isArray(projects)) {
    return { status: 'no-project' };
  }
  if (!Object.hasOwn(projects, key)) return { status: 'no-project' };

  const entry = projects[key];
  if (!entry || typeof entry !== 'object') return { status: 'bad-target' };
  const url = isAllowedTarget(entry.url);
  if (url === null) return { status: 'bad-target' };

  const updatedMs = typeof entry.updated === 'string' ? Date.parse(entry.updated) : NaN;
  if (Number.isNaN(updatedMs) || nowMs - updatedMs > maxAgeMs) {
    // updated: epoch ms, or null when missing/unparseable.
    return { status: 'stale', url, updated: Number.isNaN(updatedMs) ? null : updatedMs };
  }
  return { status: 'redirect', url };
}

export function timeAgo(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const units = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [name, size] of units) {
    if (sec >= size) {
      const n = Math.floor(sec / size);
      return `${n} ${name}${n === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}
