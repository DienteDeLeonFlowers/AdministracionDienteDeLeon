import { db, storage } from './config.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { collection, query, orderBy, limit, startAfter, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { processToWebp } from './converter.js';
import { logout, LAST_ACTIVITY_KEY, INACTIVITY_TIME } from './services/authService.js';
import { protectRoute } from './services/authGuard.js';
import { addCategory, updateCategory, toggleCategoryStatus, deleteCategory } from './services/categoryService.js';
import { addOccasion, updateOccasion, toggleOccasionStatus, deleteOccasion } from './services/occasionService.js';
import { addProduct, updateProduct, deleteProduct } from './services/productService.js';
import { addSection, updateSection, toggleSectionStatus, deleteSection, getSections } from './services/customSectionService.js';
import { addOption, updateOption, toggleOptionStatus, deleteOption, getOptionsBySection } from './services/customOptionService.js';
import { getBanners, addBanner, activateBanner, deleteBanner } from './services/bannerService.js';

let allProducts = [];
let allBanners = [];
let pageSnapshots = [null];
let pageCache = {};
let currentPage = 1;
const PAGE_SIZE = 10;
const CACHE_TTL = 60 * 60 * 1000;
let lastWriteTime = 0;
let inactivityChecker;

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
  const now = Date.now();
  if (now - lastWriteTime > 1000) {
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
    lastWriteTime = now;
  }
}

function startInactivityChecker() {
  clearInterval(inactivityChecker);
  inactivityChecker = setInterval(async () => {
    const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || '0');
    if (last && Date.now() - last > INACTIVITY_TIME) {
      clearInterval(inactivityChecker);
      await logout();
      window.location.replace('index.html?error=auth_required');
    }
  }, 2000);
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || '0');
    if (last && Date.now() - last > INACTIVITY_TIME) {
      await logout();
      window.location.replace('index.html?error=auth_required');
    } else {
      resetInactivityTimer();
    }
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

async function loadBanners() {
  const tbody = document.getElementById('bannerTableBody');
  if (!tbody) return;
  try {
    allBanners = await getBanners();
    if (allBanners.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:2rem;opacity:0.5;">Sin banners registrados</td></tr>`;
      return;
    }
    tbody.innerHTML = allBanners.map(b => `
      <tr>
        <td><img src="${b.imageUrl}" alt="Banner" loading="lazy" style="width: 150px; height: auto; border-radius: 6px;"></td>
        <td>
          <span class="status-badge ${b.activo ? 'active' : 'inactive'}" style="cursor:pointer;" onclick="toggleBannerStatusUI('${b.id}')">
            ${b.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td class="actions-cell">
          <button class="btn-action btn-delete" onclick="deleteBannerUI('${b.id}', '${b.imageUrl}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error(error);
  }
}

window.toggleBannerStatusUI = async (id) => {
  try {
    await activateBanner(id, allBanners);
    await loadBanners();
    showToast('Banner activado correctamente.');
  } catch (err) {
    showToast('Error al actualizar el banner.', 'error');
  }
};

window.deleteBannerUI = (id, imageUrl) => {
  openModal('Eliminar Banner', '<p>¿Confirmas que deseas eliminar este banner?</p>', async () => {
    try {
      await deleteBanner(id, imageUrl);
      await loadBanners();
      showToast('Banner eliminado correctamente.');
    } catch (err) {
      showToast('Error al eliminar el banner.', 'error');
    }
  });
  document.getElementById('modalSubmitBtn').classList.add('btn-delete-confirm');
};

const bannerImgInput = document.getElementById('bannerImg');
const bannerPreview = document.getElementById('bannerPreview');
const bannerPreviewContainer = document.getElementById('bannerPreviewContainer');
const bannerFilePreviewText = document.getElementById('bannerFilePreviewText');

if (bannerImgInput) {
  bannerImgInput.addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        bannerPreview.src = e.target.result;
        bannerPreviewContainer.classList.add('active');
        if (bannerFilePreviewText) bannerFilePreviewText.innerText = file.name;
      };
      reader.readAsDataURL(file);
    }
  });
}

document.getElementById('btnRemoveBanner')?.addEventListener('click', () => {
  if (bannerImgInput) bannerImgInput.value = '';
  if (bannerPreview) bannerPreview.src = '';
  if (bannerPreviewContainer) bannerPreviewContainer.classList.remove('active');
  if (bannerFilePreviewText) bannerFilePreviewText.innerText = 'Ningún archivo seleccionado';
});

document.getElementById('bannerForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!bannerImgInput.files[0]) {
    showToast('Selecciona una imagen para el banner.', 'error');
    return;
  }
  const btn = document.getElementById('bannerSubmitBtn');
  const status = document.getElementById('bannerStatus');
  btn.disabled = true;
  status.style.color = 'inherit';
  status.innerText = 'Subiendo banner...';

  try {
    const webpBlob = await processToWebp(bannerImgInput.files[0]);
    const refImg = ref(storage, `banners/${Date.now()}.webp`);
    const uploadResult = await uploadBytes(refImg, webpBlob);
    const url = await getDownloadURL(uploadResult.ref);

    await addBanner({ imageUrl: url, activo: false });

    status.innerText = '¡Banner subido con éxito!';
    status.style.color = '#00a84d';
    setTimeout(() => { status.innerText = ''; }, 3000);

    e.target.reset();
    if (bannerFilePreviewText) bannerFilePreviewText.innerText = 'Ningún archivo seleccionado';
    if (bannerPreviewContainer) bannerPreviewContainer.classList.remove('active');

    await loadBanners();
  } catch (err) {
    status.innerText = 'Error: ' + err.message;
    status.style.color = '#ff3b30';
  } finally {
    btn.disabled = false;
  }
});

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
    applyFilters();
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
  applyFilters();
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
        <span class="status-badge ${doc.activo ? 'active' : 'inactive'}" onclick="toggleStatus(event, '${colName}', '${doc.id}', ${doc.activo})">
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

window.toggleStatus = async (event, col, id, currentStat) => {
  const badge = event.currentTarget;
  const newState = !currentStat;

  badge.classList.toggle('active', newState);
  badge.classList.toggle('inactive', !newState);
  badge.innerText = newState ? 'Activa' : 'Inactiva';
  badge.setAttribute('onclick', `toggleStatus(event, '${col}', '${id}', ${newState})`);

  try {
    col === 'categorias' ? await toggleCategoryStatus(id, currentStat) : await toggleOccasionStatus(id, currentStat);
    const cacheKey = col === 'categorias' ? 'cats' : 'occs';
    let cachedData = getCached(cacheKey) || [];
    const index = cachedData.findIndex(item => item.id === id);
    if (index > -1) {
      cachedData[index].activo = newState;
      setCache(cacheKey, cachedData);
    }
    showToast('Estatus actualizado correctamente.');
  } catch (err) {
    badge.classList.toggle('active', currentStat);
    badge.classList.toggle('inactive', !currentStat);
    badge.innerText = currentStat ? 'Activa' : 'Inactiva';
    badge.setAttribute('onclick', `toggleStatus(event, '${col}', '${id}', ${currentStat})`);
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

async function loadCustomSections(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCached('custom_sections');
    if (cached) { renderSectionsTable(cached); return; }
  }
  const data = await getSections();
  setCache('custom_sections', data);
  renderSectionsTable(data);
}

function renderSectionsTable(sections) {
  const tbody = document.getElementById('sectionsTableBody');
  if (!tbody) return;
  if (sections.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;opacity:0.5;padding:2rem;">Sin secciones registradas</td></tr>`;
    return;
  }
  tbody.innerHTML = sections.map(s => `
    <tr>
      <td>${s.nombre}</td>
      <td><span class="tipo-badge tipo-${s.tipo}">${s.tipo === 'imagen' ? 'Imagen' : 'Color'}</span></td>
      <td>
        <span class="status-badge ${s.activo ? 'active' : 'inactive'}" onclick="toggleSectionStatusUI(event, '${s.id}', ${s.activo})">
          ${s.activo ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td class="actions-cell">
        <button class="btn-action btn-options" onclick="openOptionsPanel('${s.id}', \`${s.nombre}\`, '${s.tipo}')">
          <i class="fa-solid fa-list"></i>
        </button>
        <button class="btn-action btn-edit" onclick="editSectionUI('${s.id}', \`${s.nombre}\`, '${s.tipo}')">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-action btn-delete" onclick="deleteSectionUI('${s.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

window.toggleSectionStatusUI = async (event, id, currentStat) => {
  const badge = event.currentTarget;
  const newState = !currentStat;

  badge.classList.toggle('active', newState);
  badge.classList.toggle('inactive', !newState);
  badge.innerText = newState ? 'Activa' : 'Inactiva';
  badge.setAttribute('onclick', `toggleSectionStatusUI(event, '${id}', ${newState})`);

  try {
    await toggleSectionStatus(id, currentStat);
    let cachedData = getCached('custom_sections') || [];
    const index = cachedData.findIndex(item => item.id === id);
    if (index > -1) {
      cachedData[index].activo = newState;
      setCache('custom_sections', cachedData);
    }
    showToast('Estatus actualizado correctamente.');
  } catch (err) {
    badge.classList.toggle('active', currentStat);
    badge.classList.toggle('inactive', !currentStat);
    badge.innerText = currentStat ? 'Activa' : 'Inactiva';
    badge.setAttribute('onclick', `toggleSectionStatusUI(event, '${id}', ${currentStat})`);
    showToast('Error al actualizar el estatus.', 'error');
  }
};

window.editSectionUI = (id, nombre, tipo) => {
  openModal('Editar Sección',
    `${inputField('modalNombre', nombre, 'Nombre de la sección')}
     <div class="input-group" style="margin-top:1rem">
       <label style="font-size:0.85rem;font-weight:600;color:var(--green-corporate);opacity:0.7;margin-bottom:6px;display:block;">Tipo de opción</label>
       <select id="modalTipo" style="width:100%;padding:13px 16px;background:var(--input-bg);border:1px solid rgba(20,36,23,0.12);border-radius:8px;color:var(--green-corporate);font-size:16px;font-weight:500;outline:none;">
         <option value="imagen" ${tipo === 'imagen' ? 'selected' : ''}>Imagen (ej. flores)</option>
         <option value="color" ${tipo === 'color' ? 'selected' : ''}>Color (ej. papel, listón)</option>
       </select>
     </div>`,
    async () => {
      const val = document.getElementById('modalNombre').value.trim();
      const nuevoTipo = document.getElementById('modalTipo').value;
      if (!val) return;
      try {
        await updateSection(id, { nombre: val, tipo: nuevoTipo });
        clearCache('custom_sections');
        loadCustomSections(true);
        showToast('Sección actualizada correctamente.');
      } catch (err) {
        showToast('Error al actualizar la sección.', 'error');
      }
    }
  );
};

window.deleteSectionUI = (id) => {
  openModal('Eliminar Sección', '<p>¿Confirmas que deseas eliminar esta sección y todas sus opciones?</p>', async () => {
    try {
      await deleteSection(id);
      clearCache('custom_sections');
      loadCustomSections(true);
      showToast('Sección eliminada correctamente.');
    } catch (err) {
      showToast('Error al eliminar la sección.', 'error');
    }
  });
  document.getElementById('modalSubmitBtn').classList.add('btn-delete-confirm');
};

let currentSectionId = null;
let currentSectionTipo = null;
let optionImgFile = null;

window.openOptionsPanel = async (sectionId, sectionNombre, tipo) => {
  currentSectionId = sectionId;
  currentSectionTipo = tipo;
  optionImgFile = null;

  const panel = document.getElementById('panel-options');
  const title = document.getElementById('optionsSectionTitle');
  const formImg = document.getElementById('optionImageGroup');
  const formColor = document.getElementById('optionColorGroup');

  title.textContent = `Opciones — ${sectionNombre}`;
  formImg.style.display = tipo === 'imagen' ? 'flex' : 'none';
  formColor.style.display = tipo === 'color' ? 'flex' : 'none';

  document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.crud-section').forEach(s => s.classList.remove('active'));
  panel.classList.add('active');

  await loadOptions(sectionId, tipo);
};

async function loadOptions(sectionId, tipo) {
  const tbody = document.getElementById('optionsTableBody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;opacity:0.5;">Cargando...</td></tr>`;
  const data = await getOptionsBySection(sectionId);
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;opacity:0.5;">Sin opciones registradas</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(o => `
    <tr>
      <td>
        ${tipo === 'imagen'
          ? `<img src="${o.imageUrl || ''}" class="td-img" alt="${o.nombre}" loading="lazy">`
          : `<span class="color-dot" style="background:${o.color || '#ccc'}"></span>`
        }
      </td>
      <td>${o.nombre}</td>
      <td>$${Number(o.precio).toFixed(2)}</td>
      <td>
        <span class="status-badge ${o.activo ? 'active' : 'inactive'}" onclick="toggleOptionStatusUI(event, '${o.id}', ${o.activo})">
          ${o.activo ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td class="actions-cell">
        <button class="btn-action btn-edit" onclick="editOptionUI('${o.id}', \`${o.nombre}\`, ${o.precio}, '${o.imageUrl || ''}', '${o.color || ''}')">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-action btn-delete" onclick="deleteOptionUI('${o.id}', '${o.imageUrl || ''}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

window.toggleOptionStatusUI = async (event, id, currentStat) => {
  const badge = event.currentTarget;
  const newState = !currentStat;

  badge.classList.toggle('active', newState);
  badge.classList.toggle('inactive', !newState);
  badge.innerText = newState ? 'Activa' : 'Inactiva';
  badge.setAttribute('onclick', `toggleOptionStatusUI(event, '${id}', ${newState})`);

  try {
    await toggleOptionStatus(id, currentStat);
    showToast('Estatus actualizado correctamente.');
  } catch (err) {
    badge.classList.toggle('active', currentStat);
    badge.classList.toggle('inactive', !currentStat);
    badge.innerText = currentStat ? 'Activa' : 'Inactiva';
    badge.setAttribute('onclick', `toggleOptionStatusUI(event, '${id}', ${currentStat})`);
    showToast('Error al actualizar el estatus.', 'error');
  }
};

window.deleteOptionUI = (id, imageUrl) => {
  openModal('Eliminar Opción', '<p>¿Confirmas que deseas eliminar esta opción?</p>', async () => {
    try {
      await deleteOption(id, imageUrl || null);
      await loadOptions(currentSectionId, currentSectionTipo);
      showToast('Opción eliminada correctamente.');
    } catch (err) {
      showToast('Error al eliminar la opción.', 'error');
    }
  });
  document.getElementById('modalSubmitBtn').classList.add('btn-delete-confirm');
};

window.editOptionUI = (id, nombre, precio, imageUrl, color) => {
  const fields = `
    ${inputField('modalNombre', nombre, 'Nombre')}
    <div class="input-group" style="margin-top:1rem">
      <i class="fa-solid fa-dollar-sign input-icon"></i>
      <input type="number" id="modalPrecio" value="${precio}" placeholder="Precio" min="0" step="0.01" required style="padding-left:44px;">
    </div>
    ${currentSectionTipo === 'color'
      ? `<div class="input-group" style="margin-top:1rem;align-items:center;gap:12px;">
           <label style="font-size:0.85rem;font-weight:600;color:var(--green-corporate);opacity:0.7;white-space:nowrap;">Color:</label>
           <input type="color" id="modalColor" value="${color || '#ffffff'}" style="width:60px;height:40px;border:1px solid rgba(20,36,23,0.12);border-radius:8px;padding:2px;cursor:pointer;background:var(--input-bg);">
         </div>`
      : `<div style="margin-top:1rem;font-size:0.82rem;color:var(--green-corporate);opacity:0.6;">Imagen actual: ${imageUrl ? '<a href="' + imageUrl + '" target="_blank">ver</a>' : 'ninguna'}</div>
         <div class="input-group" style="margin-top:0.5rem">
           <input type="file" id="modalImg" accept="image/*" style="padding:10px 16px;">
         </div>`
    }
  `;
  openModal('Editar Opción', fields, async () => {
    const nuevoNombre = document.getElementById('modalNombre').value.trim();
    const nuevoPrecio = parseFloat(document.getElementById('modalPrecio').value);
    if (!nuevoNombre || isNaN(nuevoPrecio)) return;
    try {
      const updateData = { nombre: nuevoNombre, precio: nuevoPrecio };
      if (currentSectionTipo === 'color') {
        updateData.color = document.getElementById('modalColor').value;
      } else {
        const fileInput = document.getElementById('modalImg');
        if (fileInput && fileInput.files[0]) {
          const webpBlob = await processToWebp(fileInput.files[0]);
          const refImg = ref(storage, `custom_options/${Date.now()}.webp`);
          const uploaded = await uploadBytes(refImg, webpBlob);
          updateData.imageUrl = await getDownloadURL(uploaded.ref);
          if (imageUrl) {
            try { await deleteObject(ref(storage, imageUrl)); } catch (_) {}
          }
        }
      }
      await updateOption(id, updateData);
      await loadOptions(currentSectionId, currentSectionTipo);
      showToast('Opción actualizada correctamente.');
    } catch (err) {
      showToast('Error al actualizar la opción.', 'error');
    }
  });
};

const optionImgInput = document.getElementById('optionImg');
const optionImgPreview = document.getElementById('optionImgPreview');
const optionImgPreviewContainer = document.getElementById('optionImgPreviewContainer');

if (optionImgInput) {
  optionImgInput.addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
      optionImgFile = file;
      const reader = new FileReader();
      reader.onload = e => {
        optionImgPreview.src = e.target.result;
        optionImgPreviewContainer.classList.add('active');
      };
      reader.readAsDataURL(file);
    }
  });
}

document.getElementById('btnRemoveOptionImg')?.addEventListener('click', () => {
  if (optionImgInput) optionImgInput.value = '';
  if (optionImgPreview) optionImgPreview.src = '';
  if (optionImgPreviewContainer) optionImgPreviewContainer.classList.remove('active');
  optionImgFile = null;
});

document.getElementById('optionForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const nombre = document.getElementById('optionNombre').value.trim();
  const precio = parseFloat(document.getElementById('optionPrecio').value);
  if (!nombre || isNaN(precio)) return;

  const btn = document.getElementById('optionSubmitBtn');
  btn.disabled = true;

  try {
    const data = { seccionId: currentSectionId, nombre, precio };

    if (currentSectionTipo === 'imagen') {
      if (!optionImgFile) { showToast('Selecciona una imagen.', 'error'); btn.disabled = false; return; }
      const webpBlob = await processToWebp(optionImgFile);
      const refImg = ref(storage, `custom_options/${Date.now()}.webp`);
      const uploaded = await uploadBytes(refImg, webpBlob);
      data.imageUrl = await getDownloadURL(uploaded.ref);
    } else {
      data.color = document.getElementById('optionColor').value;
    }

    await addOption(data);
    await loadOptions(currentSectionId, currentSectionTipo);
    e.target.reset();
    if (optionImgPreviewContainer) optionImgPreviewContainer.classList.remove('active');
    optionImgFile = null;
    showToast('Opción agregada correctamente.');
  } catch (err) {
    showToast(err.message || 'Error al agregar la opción.', 'error');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('sectionForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const nombre = document.getElementById('newSectionName').value.trim();
  const tipo = document.getElementById('newSectionTipo').value;
  if (!nombre) return;
  try {
    await addSection({ nombre, tipo });
    clearCache('custom_sections');
    loadCustomSections(true);
    e.target.reset();
    showToast('Sección agregada correctamente.');
  } catch (err) {
    showToast('Error al agregar la sección.', 'error');
  }
});

document.getElementById('btnBackToSections')?.addEventListener('click', () => {
  document.querySelectorAll('.crud-section').forEach(s => s.classList.remove('active'));
  document.getElementById('panel-custom').classList.add('active');
  document.querySelectorAll('.menu-btn').forEach(b => {
    if (b.getAttribute('data-target') === 'panel-custom') b.classList.add('active');
  });
  currentSectionId = null;
  currentSectionTipo = null;
});

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
  startInactivityChecker();
  loadCategories();
  loadOccasions();
  loadCustomSections();
  loadBanners();
  fetchPage(1);
});