import { monitorAuthState } from './authService.js';

export function protectRoute(isLoginPage = false, onReady = null) {
  monitorAuthState((user) => {
    if (!user && !isLoginPage) {
      window.location.href = 'index.html?error=auth_required';
    } else if (user && isLoginPage) {
      window.location.href = 'dashboard.html';
    } else {
      document.body.classList.remove('loading');
      if (onReady) onReady();
    }
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      monitorAuthState((user) => {
        if (!user && !isLoginPage) {
          window.location.href = 'index.html?error=auth_required';
        }
      });
    }
  });
}