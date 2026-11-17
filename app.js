import { isValidProjectKey, resolveProject, timeAgo } from './lib.js';

const root = document.getElementById('app');

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(text, href) {
  const a = el('a', text);
  a.href = href;
  return a;
}

function show(...nodes) {
  root.replaceChildren(...nodes);
}

function showMessage(heading, text, ...extra) {
  show(el('h1', heading), el('p', text), ...extra);
}

async function loadTargets() {
  const res = await fetch(`targets.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function showIndex(targets) {
  const keys = [];
  const projects = targets && targets.version === 1 ? targets.projects : null;
  if (projects && typeof projects === 'object' && !Array.isArray(projects)) {
    for (const key of Object.keys(projects)) {
      if (isValidProjectKey(key)) keys.push(key);
    }
  }

  const nodes = [
    el('h1', 'Local link redirect'),
    el(
      'p',
      'Each link here sends you to a project hosted on a PC on the local network. ' +
        'Join the same Wi-Fi as that PC, then open a project link.'
    ),
  ];
  if (keys.length === 0) {
    nodes.push(el('p', 'Nothing is being hosted right now.'));
  } else {
    const ul = el('ul');
    for (const key of keys) {
      const li = el('li');
      li.append(link(key, `?project=${encodeURIComponent(key)}`));
      ul.append(li);
    }
    nodes.push(el('p', 'Currently hosted:'), ul);
  }
  show(...nodes);
}

function showResult(result) {
  switch (result.status) {
    case 'redirect': {
      // result.url has passed isAllowedTarget; it is the only destination ever used.
      const manual = el('p', 'Not redirected? ');
      manual.append(link('Open it manually', result.url));
      show(el('h1', 'Opening project'), el('p', `Opening ${result.url}...`), manual);
      location.replace(result.url);
      break;
    }
    case 'stale': {
      const when = result.updated === null ? 'some time ago' : timeAgo(Date.now() - result.updated);
      const open = el('p');
      open.append(link('Open anyway', result.url));
      showMessage(
        'Probably not running',
        `Last hosted ${when} at ${result.url}. It may not be running.`,
        open
      );
      break;
    }
    case 'no-project':
      showMessage('Not hosted', 'Nothing is being hosted under this name right now.');
      break;
    case 'bad-key':
      showMessage('Invalid link', 'This project name is not valid.');
      break;
    default:
      showMessage('Invalid entry', 'The saved address for this project is not usable.');
  }
}

async function main() {
  const key = new URLSearchParams(location.search).get('project');

  if (key !== null && !isValidProjectKey(key)) {
    showResult({ status: 'bad-key' });
    return;
  }

  let targets;
  try {
    targets = await loadTargets();
  } catch {
    showMessage('Could not load', 'Could not load the list of projects. Check your connection and try again.');
    return;
  }

  if (key === null) {
    showIndex(targets);
  } else {
    showResult(resolveProject(targets, key, Date.now()));
  }
}

main();
