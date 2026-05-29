import { getAuthState } from './authService.js';

export async function protectRoute(isLoginPage = false, onReady = null) {
  const user = await getAuthState();

  if (!user && !isLoginPage) {
    window.location.href = 'index.html?error=auth_required';
    return;
  }

  if (user && isLoginPage) {
    window.location.href = 'dashboard.html';
    return;
  }

  document.body.classList.remove('loading');
  if (onReady) onReady();

  window.addEventListener('pageshow', async (event) => {
    if (event.persisted) {
      const currentUser = await getAuthState();
      if (!currentUser && !isLoginPage) {
        window.location.replace('index.html?error=auth_required');
      }
    }
  });
}