import { db, storage } from './config.js';
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { processToJpg } from './converter.js';
import { logout } from './services/authService.js';
import { protectRoute } from './services/authGuard.js';
import { addCategory, toggleCategoryStatus, deleteCategory } from './services/categoryService.js';
import { addOccasion, toggleOccasionStatus, deleteOccasion } from './services/occasionService.js';
import { addProduct } from './services/productService.js';

protectRoute();

const INACTIVITY_TIME = 15 * 60 * 1000;
let inactivityTimeout;

function resetInactivityTimer() {
  clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(async () => {
    await logout();
    window.location.href = 'index.html';
  }, INACTIVITY_TIME);
}

['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});
resetInactivityTimer();

function updateExclusiveLogic() {
  const categoryVal = document.getElementById('itemCategory').value;
  const selectedOccasion = document.querySelector('input[name="occasion"]:checked');
  const occasionsContainer = document.querySelector('.occasions-sect');
  const categoryDropdown = document.getElementById('categoryDropdown');
  
  occasionsContainer.classList.toggle('disabled-group', categoryVal !== "");
  categoryDropdown.classList.toggle('disabled-group', !!selectedOccasion);
}

function renderTable(containerId, data, colName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = data.map(doc => `
    <tr>
      <td>${doc.nombre}</td>
      <td>
        <span class="status-badge ${doc.activo ? 'active' : 'inactive'}" 
              onclick="toggleStatus('${colName}', '${doc.id}', ${doc.activo})">
          ${doc.activo ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td class="actions-cell">
        <button class="btn-action btn-delete" onclick="deleteItem('${colName}', '${doc.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

window.toggleStatus = async (col, id, stat) => col === 'categorias' ? await toggleCategoryStatus(id, stat) : await toggleOccasionStatus(id, stat);
window.deleteItem = async (col, id) => col === 'categorias' ? await deleteCategory(id) : await deleteOccasion(id);

onSnapshot(query(collection(db, "categorias"), orderBy("fecha", "desc")), (snap) => {
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTable('categoriesTableBody', data, 'categorias');
  
  const menu = document.getElementById('dropdownMenuCategories');
  if (menu) {
    menu.innerHTML = `<li class="dropdown-item" data-value="">Ninguna categoría</li>` + 
      data.filter(d => d.activo).map(d => `<li class="dropdown-item" data-value="${d.id}">${d.nombre}</li>`).join('');
    document.querySelectorAll('.dropdown-item').forEach(item => item.onclick = () => {
      document.getElementById('itemCategory').value = item.getAttribute('data-value');
      document.getElementById('dropdownSelectedText').innerText = item.innerText;
      document.getElementById('dropdownMenuCategories').classList.remove('show');
      updateExclusiveLogic();
    });
  }
});

onSnapshot(query(collection(db, "ocasiones"), orderBy("fecha", "desc")), (snap) => {
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTable('occasionsTableBody', data, 'ocasiones');
  
  const grid = document.getElementById('checkboxGridOccasions');
  if (grid) {
    grid.innerHTML = data.filter(d => d.activo).map(d => `<label class="checkbox-item"><input type="radio" name="occasion" value="${d.id}"><span>${d.nombre}</span></label>`).join('');
    document.querySelectorAll('input[name="occasion"]').forEach(cb => cb.onclick = function() {
      if (this.dataset.waschecked === 'true') { this.checked = false; this.dataset.waschecked = 'false'; } 
      else { document.querySelectorAll('input[name="occasion"]').forEach(i => i.dataset.waschecked = 'false'); this.dataset.waschecked = 'true'; }
      updateExclusiveLogic();
    });
  }
});

document.getElementById('dropdown-trigger')?.addEventListener('click', () => document.getElementById('dropdownMenuCategories').classList.toggle('show'));

document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const status = document.getElementById('status');
  try {
    btn.disabled = true;
    status.innerText = "Procesando...";
    const jpgBlob = await processToJpg(document.getElementById('itemImg').files[0]);
    const refImg = ref(storage, `catalog/${Date.now()}.jpg`);
    const url = await getDownloadURL((await uploadBytes(refImg, jpgBlob)).ref);
    
    await addProduct({
      nombre: document.getElementById('itemName').value,
      descripcion: document.getElementById('itemDesc').value,
      imageUrl: url,
      categoria: document.getElementById('itemCategory').value,
      ocasiones: document.querySelector('input[name="occasion"]:checked')?.value || null
    });
    status.innerText = "¡Publicado!";
    e.target.reset();
    updateExclusiveLogic();
  } catch (err) { status.innerText = "Error: " + err.message; }
  finally { btn.disabled = false; }
});

document.getElementById('categoryForm')?.addEventListener('submit', async (e) => { e.preventDefault(); await addCategory(document.getElementById('newCategoryName').value); e.target.reset(); });
document.getElementById('occasionForm')?.addEventListener('submit', async (e) => { e.preventDefault(); await addOccasion(document.getElementById('newOccasionName').value); e.target.reset(); });
document.getElementById('logoutBtn')?.addEventListener('click', async () => { await logout(); window.location.href = 'index.html'; });