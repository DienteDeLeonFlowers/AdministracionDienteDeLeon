import { db, storage } from './config.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { collection, query, orderBy, limit, startAfter, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { processToWebp } from './converter.js';
import { logout, LAST_ACTIVITY_KEY, INACTIVITY_TIME } from './services/authService.js';
import { protectRoute } from './services/authGuard.js';
import { addCategory, updateCategory, toggleCategoryStatus, deleteCategory } from './services/categoryService.js';
import { addOccasion, updateOccasion, toggleOccasionStatus, deleteOccasion } from './services/occasionService.js';
import { addProduct, updateProduct, deleteProduct } from './services/productService.js';

let allProducts = [];
let pageSnapshots = [null];
let pageCache = {};
let currentPage = 1;
const PAGE_SIZE = 10;
const CACHE_TTL = 1 * 60 * 1000;
let inactivityTimeout;

const itemImg = document.getElementById('itemImg');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const categoryDropdown = document.getElementById('categoryDropdown');
const filterDropdown = document.getElementById('filterDropdown');

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  const icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
  toast.innerHTML = `${icon}<span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3500);
}

function resetInactivityTimer() {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now());
  clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(async () => {
    await logout();
    window.location.replace('index.html');
  }, INACTIVITY_TIME);
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || '0');
    if (!last || Date.now() - last > INACTIVITY_TIME) {
      await logout();
      window.location.replace('index.html');
    } else {
      resetInactivityTimer();
    }
  } else {
    clearTimeout(inactivityTimeout);
  }
});

['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

const contentPanel = document.querySelector('.content-panel');
if (contentPanel) {
  contentPanel.addEventListener('scroll', resetInactivityTimer, { passive: true });
}

function getCached(key) {
  try {
    const data = sessionStorage.getItem(key);
    const ts = sessionStorage.getItem(key + '_ts');
    if (data && ts && Date.now() - Number(ts) < CACHE_TTL) return JSON.parse(data);
  } catch (_) {}
  return null;
}

function setCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
    sessionStorage.setItem(key + '_ts', Date.now());
  } catch (_) {}
}

function clearCache(key) {
  sessionStorage.removeItem(key);
  sessionStorage.removeItem(key + '_ts');
}

function getClasificacionNombre(catId, occId) {
  const cats = getCached('cats') || [];
  const occs = getCached('occs') || [];
  const categoria = cats.find(c => c.id === catId);
  const ocasion = occs.find(o => o.id === occId);
  return (categoria ? categoria.nombre : '') || (ocasion ? ocasion.nombre : '') || '—';
}

async function loadCategories(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCached('cats');
    if (cached) {
      renderTable('categoriesTableBody', cached, 'categorias');
      buildCategoryDropdown(cached);
      updateFilterSelects();
      return;
    }
  }
  const snap = await getDocs(collection(db, 'categorias'));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  setCache('cats', data);
  renderTable('categoriesTableBody', data, 'categorias');
  buildCategoryDropdown(data);
  updateFilterSelects();
}

async function loadOccasions(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCached('occs');
    if (cached) {
      renderTable('occasionsTableBody', cached, 'ocasiones');
      buildOccasionCheckboxes(cached);
      updateFilterSelects();
      return;
    }
  }
  const snap = await getDocs(collection(db, 'ocasiones'));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  setCache('occs', data);
  renderTable('occasionsTableBody', data, 'ocasiones');
  buildOccasionCheckboxes(data);
  updateFilterSelects();
}

function buildCategoryDropdown(data) {
  const menu = document.getElementById('dropdownMenuCategories');
  if (!menu) return;
  menu.innerHTML = `<li class="dropdown-item" data-value="">Ninguna categoría</li>` +
    data.filter(d => d.activo).map(d => `<li class="dropdown-item" data-value="${d.id}">${d.nombre}</li>`).join('');
  document.querySelectorAll('#dropdownMenuCategories .dropdown-item').forEach(item => {
    item.onclick = () => {
      document.getElementById('itemCategory').value = item.getAttribute('data-value');
      document.getElementById('dropdownSelectedText').innerText = item.innerText;
      categoryDropdown.classList.remove('active');
      updateExclusiveLogic();
    };
  });
}

function buildOccasionCheckboxes(data) {
  const grid = document.getElementById('checkboxGridOccasions');
  if (!grid) return;
  grid.innerHTML = data.filter(d => d.activo).map(d =>
    `<label class="checkbox-label"><input type="radio" name="occasion" value="${d.id}"><span class="custom-checkbox"></span>${d.nombre}</label>`
  ).join('');
  document.querySelectorAll('input[name="occasion"]').forEach(cb => cb.addEventListener('click', updateExclusiveLogic));
}

function updateFilterSelects() {
  const menu = document.getElementById('dropdownMenuFilter');
  if (!menu) return;
  const cats = getCached('cats') || [];
  const occs = getCached('occs') || [];

  let html = `<li class="dropdown-item filter-item" data-value="" data-label="Todas">
    <span class="filter-badge filter-all">Todas</span>
  </li>`;

  if (cats.length > 0) {
    html += `<li class="dropdown-divider-label">Categorías</li>`;
    cats.forEach(d => {
      html += `<li class="dropdown-item filter-item" data-value="${d.id}" data-label="${d.nombre}">
        <span class="filter-badge filter-cat">${d.nombre}</span>
      </li>`;
    });
  }

  if (occs.length > 0) {
    html += `<li class="dropdown-divider-label">Fechas Especiales</li>`;
    occs.forEach(d => {
      html += `<li class="dropdown-item filter-item" data-value="${d.id}" data-label="${d.nombre}">
        <span class="filter-badge filter-occ">${d.nombre}</span>
      </li>`;
    });
  }

  menu.innerHTML = html;

  document.querySelectorAll('#dropdownMenuFilter .filter-item').forEach(item => {
    item.onclick = () => {
      document.getElementById('filterCategory').value = item.getAttribute('data-value');
      document.getElementById('filterSelectedText').innerText = item.getAttribute('data-label');
      filterDropdown.classList.remove('active');
      applyFilters();
    };
  });
}

function renderCatalogTable(data) {
  const container = document.getElementById('catalogTableBody');
  if (!container) return;
  container.innerHTML = data.map(doc => `
    <tr>
      <td><img src="${doc.imageUrl}" class="td-img" alt="${doc.nombre}" loading="lazy"></td>
      <td>${doc.nombre}</td>
      <td>${doc.descripcion || '—'}</td>
      <td>${getClasificacionNombre(doc.categoria, doc.ocasiones)}</td>
      <td class="actions-cell">
        <button class="btn-action btn-edit" onclick="editProduct('${doc.id}', \`${doc.nombre}\`, \`${doc.descripcion || ''}\`)">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-action btn-delete" onclick="removeProduct('${doc.id}', '${doc.imageUrl}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

window.applyFilters = () => {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const filterVal = document.getElementById('filterCategory').value;
  const filtered = allProducts.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(searchTerm);
    const matchesCat = filterVal === "" || p.categoria === filterVal || p.ocasiones === filterVal;
    return matchesSearch && matchesCat;
  });
  renderCatalogTable(filtered);
};

async function fetchPage(page) {
  if (pageCache[page]) {
    allProducts = pageCache[page].data;
    currentPage = page;
    renderCatalogTable(allProducts);
    renderPagination(currentPage, pageCache[page].totalPages, pageCache[page].hasMore);
    return;
  }

  const cursor = pageSnapshots[page - 1];
  let q = query(collection(db, 'productos'), orderBy('fecha', 'desc'), limit(PAGE_SIZE));
  if (cursor) {
    q = query(collection(db, 'productos'), orderBy('fecha', 'desc'), startAfter(cursor), limit(PAGE_SIZE));
  }
  const snap = await getDocs(q);
  if (snap.empty && page > 1) return;
  if (snap.docs.length > 0 && !pageSnapshots[page]) {
    pageSnapshots[page] = snap.docs[snap.docs.length - 1];
  }
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  allProducts = data;
  currentPage = page;
  const hasMore = snap.docs.length === PAGE_SIZE;
  const totalPages = hasMore ? Math.max(pageSnapshots.filter(Boolean).length, page + 1) : page;
  pageCache[page] = { data, totalPages, hasMore };
  renderCatalogTable(allProducts);
  renderPagination(currentPage, totalPages, hasMore);
}

function invalidatePageCache() {
  pageCache = {};
  pageSnapshots = [null];
}

function renderPagination(current, total, hasMore) {
  const wrap = document.getElementById('paginationBar');
  if (!wrap) return;
  wrap.innerHTML = '';

  const makeBtn = (html, page, extraClass = '') => {
    const b = document.createElement('button');
    b.className = 'btn-page' + (extraClass ? ' ' + extraClass : '');
    b.innerHTML = html;
    if (page !== null) b.addEventListener('click', () => fetchPage(page));
    return b;
  };

  const makeDots = () => {
    const s = document.createElement('span');
    s.className = 'page-dots';
    s.textContent = '···';
    return s;
  };

  const prevBtn = makeBtn('<i class="fa-solid fa-chevron-left"></i>', current - 1);
  if (current === 1) prevBtn.disabled = true;
  wrap.appendChild(prevBtn);

  let pages = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
  }

  pages.forEach(p => {
    if (p === '...') wrap.appendChild(makeDots());
    else wrap.appendChild(makeBtn(p, p, p === current ? 'active' : ''));
  });

  const nextBtn = makeBtn('<i class="fa-solid fa-chevron-right"></i>', current + 1);
  if (!hasMore && current === total) nextBtn.disabled = true;
  wrap.appendChild(nextBtn);
}

function renderTable(containerId, data, colName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = data.map(doc => `
    <tr>
      <td>${doc.nombre}</td>
      <td>
        <span class="status-badge ${doc.activo ? 'active' : 'inactive'}" onclick="toggleStatus('${colName}', '${doc.id}', ${doc.activo})">
          ${doc.activo ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td class="actions-cell">
        <button class="btn-action btn-edit" onclick="editItem('${colName}', '${doc.id}', \`${doc.nombre}\`)">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-action btn-delete" onclick="deleteItem('${colName}', '${doc.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

window.toggleStatus = async (col, id, stat) => {
  try {
    col === 'categorias' ? await toggleCategoryStatus(id, stat) : await toggleOccasionStatus(id, stat);
    clearCache(col === 'categorias' ? 'cats' : 'occs');
    col === 'categorias' ? loadCategories(true) : loadOccasions(true);
    showToast('Estatus actualizado correctamente.');
  } catch (err) {
    showToast('Error al actualizar el estatus.', 'error');
  }
};

window.deleteItem = async (col, id) => {
  openModal('Eliminar', '<p>¿Confirmas que deseas eliminar este elemento?</p>', async () => {
    try {
      col === 'categorias' ? await deleteCategory(id) : await deleteOccasion(id);
      clearCache(col === 'categorias' ? 'cats' : 'occs');
      col === 'categorias' ? loadCategories(true) : loadOccasions(true);
      showToast('Elemento eliminado correctamente.');
    } catch (err) {
      showToast('Error al eliminar el elemento.', 'error');
    }
  });
  document.getElementById('modalSubmitBtn').classList.add('btn-delete-confirm');
};

window.editItem = (col, id, nombre) => {
  openModal(
    col === 'categorias' ? 'Editar Categoría' : 'Editar Fecha Especial',
    inputField('modalNombre', nombre, 'Nombre'),
    async () => {
      const val = document.getElementById('modalNombre').value.trim();
      if (!val) return;
      try {
        col === 'categorias' ? await updateCategory(id, val) : await updateOccasion(id, val);
        clearCache(col === 'categorias' ? 'cats' : 'occs');
        col === 'categorias' ? loadCategories(true) : loadOccasions(true);
        showToast('Elemento actualizado correctamente.');
      } catch (err) {
        showToast('Error al actualizar el elemento.', 'error');
      }
    }
  );
};

window.editProduct = (id, nombre, descripcion) => {
  openModal('Editar Arreglo',
    `${inputField('modalNombre', nombre, 'Nombre del ramo')}
     <div class="input-group" style="margin-top:1rem">
       <textarea id="modalDesc" placeholder="Descripción">${descripcion}</textarea>
     </div>`,
    async () => {
      const nuevoNombre = document.getElementById('modalNombre').value.trim();
      const nuevaDesc = document.getElementById('modalDesc').value.trim();
      if (!nuevoNombre) return;
      try {
        await updateProduct(id, { nombre: nuevoNombre, descripcion: nuevaDesc });
        invalidatePageCache();
        fetchPage(currentPage);
        showToast('Arreglo actualizado correctamente.');
      } catch (err) {
        showToast('Error al actualizar el arreglo.', 'error');
      }
    }
  );
};

window.removeProduct = async (id, imageUrl) => {
  openModal('Eliminar producto', '<p>¿Confirmas que deseas eliminar este arreglo?</p>', async () => {
    try {
      await deleteProduct(id);
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
      invalidatePageCache();
      currentPage = 1;
      fetchPage(1);
      showToast('Arreglo eliminado correctamente.');
    } catch (err) {
      showToast('Error al eliminar el arreglo.', 'error');
    }
  });
  document.getElementById('modalSubmitBtn').classList.add('btn-delete-confirm');
};

document.querySelector('#categoryDropdown .dropdown-trigger')?.addEventListener('click', () => {
  categoryDropdown.classList.toggle('active');
});

document.querySelector('#filterDropdown .dropdown-trigger')?.addEventListener('click', () => {
  filterDropdown.classList.toggle('active');
});

document.addEventListener('click', (e) => {
  if (categoryDropdown && !categoryDropdown.contains(e.target)) categoryDropdown.classList.remove('active');
  if (filterDropdown && !filterDropdown.contains(e.target)) filterDropdown.classList.remove('active');
});

function updateExclusiveLogic() {
  const categoryVal = document.getElementById('itemCategory').value;
  const selectedOccasion = document.querySelector('input[name="occasion"]:checked');
  document.querySelector('.occasions-sect').classList.toggle('disabled-group', categoryVal !== '');
  categoryDropdown.classList.toggle('disabled-group', !!selectedOccasion);
}

const editModal = document.getElementById('editModal');
const modalTitle = document.getElementById('modalTitle');
const modalFields = document.getElementById('modalFormFields');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalForm = document.getElementById('modalEditForm');
let currentEditFn = null;

function openModal(title, fields, onSave) {
  const btn = document.getElementById('modalSubmitBtn');
  if (btn) btn.className = 'btn-primary';
  modalTitle.textContent = title;
  modalFields.innerHTML = fields;
  currentEditFn = onSave;
  editModal.classList.add('active');
}

function closeModal() {
  editModal.classList.remove('active');
  currentEditFn = null;
  modalFields.innerHTML = '';
}

closeModalBtn?.addEventListener('click', closeModal);
editModal?.addEventListener('click', e => { if (e.target === editModal) closeModal(); });

modalForm?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentEditFn) return;
  const btn = modalForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  await currentEditFn();
  closeModal();
  btn.disabled = false;
});

function inputField(id, value, placeholder) {
  return `<div class="input-group" style="margin-bottom:0"><input type="text" id="${id}" value="${value}" placeholder="${placeholder}" required></div>`;
}

itemImg.addEventListener('change', function () {
  const file = this.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      imagePreview.src = e.target.result;
      imagePreviewContainer.classList.add('active');
      document.getElementById('file-name-preview').innerText = file.name;
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById('btnRemoveImage')?.addEventListener('click', () => {
  itemImg.value = '';
  imagePreview.src = '';
  imagePreviewContainer.classList.remove('active');
  document.getElementById('file-name-preview').innerText = 'Ningún archivo seleccionado';
});

document.getElementById('uploadForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const validationMsg = document.getElementById('validationMessage');
  const categoryVal = document.getElementById('itemCategory').value;
  const selectedOccasion = document.querySelector('input[name="occasion"]:checked');
  if (!categoryVal && !selectedOccasion) {
    validationMsg.style.display = 'block';
    setTimeout(() => { validationMsg.style.display = 'none'; }, 4000);
    return;
  }
  validationMsg.style.display = 'none';
  const btn = document.getElementById('submitBtn');
  const status = document.getElementById('status');
  const itemName = document.getElementById('itemName');
  const itemDesc = document.getElementById('itemDesc');
  const itemCategory = document.getElementById('itemCategory');

  try {
    btn.disabled = true;
    status.style.color = 'inherit';
    status.innerText = 'Procesando...';

    const webpBlob = await processToWebp(itemImg.files[0]);
    const refImg = ref(storage, `catalog/${Date.now()}.webp`);
    const uploadResult = await uploadBytes(refImg, webpBlob);
    const url = await getDownloadURL(uploadResult.ref);

    await addProduct({
      nombre: itemName.value,
      descripcion: itemDesc.value,
      imageUrl: url,
      categoria: itemCategory.value,
      ocasiones: selectedOccasion?.value || null,
      fecha: new Date().toISOString()
    });

    status.innerText = '¡Arreglo subido con éxito!';
    status.style.color = '#00a84d';
    setTimeout(() => { status.innerText = ''; }, 3000);

    e.target.reset();
    document.getElementById('file-name-preview').innerText = 'Ningún archivo seleccionado';
    imagePreviewContainer.classList.remove('active');
    document.getElementById('dropdownSelectedText').innerText = 'Ninguna categoría';
    invalidatePageCache();
    currentPage = 1;
    updateExclusiveLogic();
    fetchPage(1);
  } catch (err) {
    status.innerText = 'Error: ' + err.message;
    status.style.color = '#ff3b30';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('categoryForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await addCategory(document.getElementById('newCategoryName').value.trim());
    clearCache('cats');
    loadCategories(true);
    e.target.reset();
    showToast('Categoría agregada correctamente.');
  } catch (err) {
    showToast('Error al agregar la categoría.', 'error');
  }
});

document.getElementById('occasionForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await addOccasion(document.getElementById('newOccasionName').value.trim());
    clearCache('occs');
    loadOccasions(true);
    e.target.reset();
    showToast('Fecha especial agregada correctamente.');
  } catch (err) {
    showToast('Error al agregar la fecha especial.', 'error');
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await logout();
  window.location.replace('index.html');
});

document.querySelectorAll('.table-responsive').forEach(el => {
  el.addEventListener('touchstart', e => { e.stopPropagation(); resetInactivityTimer(); }, { passive: true });
  el.addEventListener('touchmove', e => { e.stopPropagation(); resetInactivityTimer(); }, { passive: true });
  el.addEventListener('touchend', e => { e.stopPropagation(); resetInactivityTimer(); }, { passive: true });
});

protectRoute(false, () => {
  resetInactivityTimer();
  loadCategories();
  loadOccasions();
  fetchPage(1);
});