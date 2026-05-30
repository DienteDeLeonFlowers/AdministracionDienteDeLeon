import { getAuthState, logout, FORCE_LOGOUT_KEY, LAST_ACTIVITY_KEY, INACTIVITY_TIME } from './authService.js';

export async function protectRoute(isLoginPage = false, onReady = null) {
  if (!isLoginPage) {
    document.body.style.visibility = 'hidden';

    const forceOut = localStorage.getItem(FORCE_LOGOUT_KEY) === '1';
    const last = localStorage.getItem(LAST_ACTIVITY_KEY);
    const inactive = last && Date.now() - Number(last) > INACTIVITY_TIME;

    if (forceOut || inactive) {
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

      const forceOut = localStorage.getItem(FORCE_LOGOUT_KEY) === '1';
      const last = localStorage.getItem(LAST_ACTIVITY_KEY);
      const inactive = last && Date.now() - Number(last) > INACTIVITY_TIME;

      if (forceOut || inactive || !last) {
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