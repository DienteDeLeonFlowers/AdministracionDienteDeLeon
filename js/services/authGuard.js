import { getAuthState, logout, LAST_ACTIVITY_KEY, SESSION_ID_KEY, INACTIVITY_TIME } from './authService.js';

function sessionExpired() {
  const localSid = localStorage.getItem(SESSION_ID_KEY);
  const sessionSid = sessionStorage.getItem(SESSION_ID_KEY);
  if (!localSid || !sessionSid || localSid !== sessionSid) return true;
  const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || '0');
  if (!last || Date.now() - last > INACTIVITY_TIME) return true;
  return false;
}

export async function protectRoute(isLoginPage = false, onReady = null) {
  if (!isLoginPage) {
    document.body.style.visibility = 'hidden';
    if (sessionExpired()) {
      await logout();
      window.location.replace('index.html?error=auth_required');
      return;
    }
  }

  const user = await getAuthState();

  if (!user && !isLoginPage) {
    await logout();
    window.location.replace('index.html?error=auth_required');
    return;
  }

  if (user && isLoginPage) {
    window.location.replace('dashboard.html');
    return;
  }

  document.body.style.visibility = '';
  document.body.classList.remove('loading');
  if (onReady) onReady();

  window.addEventListener('pageshow', async (event) => {
    if (event.persisted) {
      document.body.style.visibility = 'hidden';
      if (sessionExpired()) {
        await logout();
        window.location.replace('index.html?error=auth_required');
        return;
      }
      const currentUser = await getAuthState();
      if (!currentUser) {
        await logout();
        window.location.replace('index.html?error=auth_required');
        return;
      }
      document.body.style.visibility = '';
    }
  });
}