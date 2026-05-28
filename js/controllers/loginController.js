import { login } from '../services/authService.js';
import { protectRoute } from '../services/authGuard.js';

protectRoute(true);

const loginForm = document.getElementById('loginForm');
const toggleBtn = document.getElementById('togglePassword');
const passInput = document.getElementById('loginPassword');
const status = document.getElementById('loginStatus');

function checkAuthMessage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('error') === 'auth_required') {
    if (status) {
      status.innerText = "⚠️ Debes iniciar sesión con credenciales de administrador";
      status.style.color = "#ff3b30";
      setTimeout(() => {
        status.innerText = "";
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 5000);
    }
  }
}

checkAuthMessage();

if (toggleBtn && passInput) {
  toggleBtn.addEventListener('click', () => {
    const isPassword = passInput.getAttribute('type') === 'password';
    passInput.setAttribute('type', isPassword ? 'text' : 'password');
    toggleBtn.classList.toggle('fa-eye', !isPassword);
    toggleBtn.classList.toggle('fa-eye-slash', isPassword);
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;

    status.innerText = "Ingresando...";
    status.style.color = "var(--sand-light)";

    login(email, pass)
      .then(() => {
        window.location.href = 'dashboard.html';
      })
      .catch((error) => {
        status.innerText = "ACCESO DENEGADO";
        status.style.color = "#ff3b30";
        console.error("Error de autenticación:", error.message);
      });
  });
}