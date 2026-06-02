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
    document.body.style.display = 'none';
  }

  const checkAccess = async () => {
    if (!isLoginPage && sessionExpired()) {
      await logout();
      window.location.replace('index.html?error=auth_required');
      return false;
    }

    const user = await getAuthState();

    if (!user && !isLoginPage) {
      await logout();
      window.location.replace('index.html?error=auth_required');
      return false;
    }

    if (user && isLoginPage) {
      window.location.replace('dashboard.html');
      return false;
    }

    return true;
  };

  const canAccess = await checkAccess();

  if (canAccess) {
    if (!isLoginPage) document.body.style.display = '';
    document.body.classList.remove('loading');
    if (onReady) onReady();
  }

  window.addEventListener('pageshow', async (event) => {
    const isBackForward = performance.getEntriesByType("navigation").length > 0 && performance.getEntriesByType("navigation")[0].type === "back_forward";
    
    if (event.persisted || isBackForward) {
      if (!isLoginPage) document.body.style.display = 'none';
      const stillValid = await checkAccess();
      if (stillValid && !isLoginPage) document.body.style.display = '';
    }
  });

  window.addEventListener('storage', async (event) => {
    if (event.key === 'logout_event' || (event.key === SESSION_ID_KEY && !event.newValue)) {
      if (!isLoginPage) {
        document.body.style.display = 'none';
        await logout();
        window.location.replace('index.html?error=auth_required');
      }
    }
  });
}