// Development-only access switch. Never enabled in normal builds unless explicitly requested.
export function isDevMode() {
  try {
    return new URLSearchParams(window.location.search).get('dev') === '1'
      || window.localStorage.getItem('imunverse.devMode') === '1';
  } catch { return false; }
}

export function devLabel() { return isDevMode() ? 'DEV MODE' : ''; }
