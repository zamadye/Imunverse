// Development-only access switch. Never enabled in normal builds unless explicitly requested.
export function isDevMode() {
  try {
    const flag = new URLSearchParams(window.location.search).get('dev');
    const stored = window.localStorage.getItem('imunverse.devMode');
    return ['1', 'true', 'on', 'yes'].includes(String(flag).toLowerCase())
      || ['1', 'true', 'on', 'yes'].includes(String(stored).toLowerCase());
  } catch { return false; }
}

export function devLabel() { return isDevMode() ? 'DEV MODE' : ''; }
