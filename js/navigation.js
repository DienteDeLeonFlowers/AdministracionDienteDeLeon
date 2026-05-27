const menuButtons = document.querySelectorAll('.menu-btn');
const crudSections = document.querySelectorAll('.crud-section');
const navIndicator = document.querySelector('.nav-indicator');
const sidebarMenu = document.querySelector('.sidebar-menu');

const panelsOrder = ['panel-upload', 'panel-view-catalog', 'panel-categories', 'panel-occasions'];

function getActivePanelIndex() {
  const active = Array.from(crudSections).find(s => s.classList.contains('active'));
  return active ? panelsOrder.indexOf(active.id) : 0;
}

function setIndicator(index, animate = true) {
  if (!sidebarMenu || !navIndicator) return;
  navIndicator.style.transition = animate ? 'transform 0.42s cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
  sidebarMenu.style.setProperty('--indicator-index', index);
}

function setActiveBtn(index) {
  menuButtons.forEach((btn, i) => btn.classList.toggle('active', i === index));
}

function switchPanel(panelId, animate = true) {
  const index = panelsOrder.indexOf(panelId);
  if (index === -1) return;
  setActiveBtn(index);
  setIndicator(index, animate);
  crudSections.forEach(s => s.classList.toggle('active', s.id === panelId));
}

menuButtons.forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    switchPanel(btn.getAttribute('data-target'));
  });
});

setTimeout(() => {
  setIndicator(getActivePanelIndex(), false);
  requestAnimationFrame(() => {
    if (navIndicator) navIndicator.style.transition = 'transform 0.42s cubic-bezier(0.25, 1, 0.5, 1)';
  });
}, 80);

window.addEventListener('resize', () => setIndicator(getActivePanelIndex(), false));

if (sidebarMenu && navIndicator) {
  let dragging = false;
  let startX = 0;
  let startIndex = 0;
  let liveIndex = 0;
  let pointerId = null;

  sidebarMenu.addEventListener('pointerdown', e => {
    if (window.innerWidth > 860) return;
    dragging = false;
    startX = e.clientX;
    startIndex = getActivePanelIndex();
    liveIndex = startIndex;
    pointerId = e.pointerId;
    sidebarMenu.setPointerCapture(e.pointerId);
  });

  sidebarMenu.addEventListener('pointermove', e => {
    if (window.innerWidth > 860 || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    if (!dragging && Math.abs(dx) < 6) return;
    if (!dragging) { dragging = true; navIndicator.style.transition = 'none'; }
    const menuW = sidebarMenu.offsetWidth - 8;
    const stepPx = menuW / panelsOrder.length;
    const raw = startIndex + dx / stepPx;
    const clamped = Math.min(Math.max(raw, 0), panelsOrder.length - 1);
    sidebarMenu.style.setProperty('--indicator-index', clamped);
    const snapped = Math.round(clamped);
    if (snapped !== Math.round(liveIndex)) setActiveBtn(snapped);
    liveIndex = clamped;
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    pointerId = null;
    const finalIdx = Math.min(Math.max(Math.round(liveIndex), 0), panelsOrder.length - 1);
    switchPanel(panelsOrder[finalIdx], true);
  }
  sidebarMenu.addEventListener('pointerup', endDrag);
  sidebarMenu.addEventListener('pointercancel', endDrag);
}

let swipeStartX = 0;
let swipeStartY = 0;
let swipeOnNav = false;

window.addEventListener('touchstart', e => {
  if (window.innerWidth > 860) return;
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
  swipeOnNav = sidebarMenu?.contains(e.target) ?? false;
}, { passive: true });

window.addEventListener('touchend', e => {
  if (window.innerWidth > 860 || swipeOnNav) return;
  const dx = swipeStartX - e.changedTouches[0].clientX;
  const dy = swipeStartY - e.changedTouches[0].clientY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
    const cur = getActivePanelIndex();
    if (dx > 0 && cur < panelsOrder.length - 1) switchPanel(panelsOrder[cur + 1]);
    else if (dx < 0 && cur > 0) switchPanel(panelsOrder[cur - 1]);
  }
}, { passive: true });