import { VERSION } from './constants.js';

function init() {
  const versionEl = document.getElementById('version-text');
  if (versionEl) versionEl.textContent = VERSION;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
