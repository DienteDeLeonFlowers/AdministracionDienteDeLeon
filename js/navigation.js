const menuButtons = document.querySelectorAll('.menu-btn');
const crudSections = document.querySelectorAll('.crud-section');
const navIndicator = document.querySelector('.nav-indicator');
const sidebarMenu = document.querySelector('.sidebar-menu');

const panelsOrder = Array.from(menuButtons).map(btn => btn.getAttribute('data-target'));

const MOBILE_BREAKPOINT = 860;

function isMobileLayout() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

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

  let touchDragging = false;
  let touchStartX = 0;
  let touchStartIndex = 0;
  let touchLiveIndex = 0;

  sidebarMenu.addEventListener('touchstart', e => {
    if (!isMobileLayout()) return;
    touchDragging = false;
    touchStartX = e.touches[0].clientX;
    touchStartIndex = getActivePanelIndex();
    touchLiveIndex = touchStartIndex;
  }, { passive: true });

  sidebarMenu.addEventListener('touchmove', e => {
    if (!isMobileLayout()) return;
    const dx = e.touches[0].clientX - touchStartX;

    if (!touchDragging && Math.abs(dx) > 6) {
      touchDragging = true;
      navIndicator.style.transition = 'none';
    }

    if (touchDragging) {
      e.preventDefault();
      const menuW = sidebarMenu.offsetWidth - 8;
      const stepPx = menuW / panelsOrder.length;
      const raw = touchStartIndex + dx / stepPx;
      const clamped = Math.min(Math.max(raw, 0), panelsOrder.length - 1);

      sidebarMenu.style.setProperty('--indicator-index', clamped);
      const snapped = Math.round(clamped);
      if (snapped !== Math.round(touchLiveIndex)) setActiveBtn(snapped);
      touchLiveIndex = clamped;
    }
  }, { passive: false });

  sidebarMenu.addEventListener('touchend', e => {
    if (!isMobileLayout()) return;
    if (!touchDragging) return;
    touchDragging = false;
    const finalIdx = Math.min(Math.max(Math.round(touchLiveIndex), 0), panelsOrder.length - 1);
    switchPanel(panelsOrder[finalIdx], true);
  }, { passive: true });

  let dragging = false;
  let startX = 0;
  let startIndex = 0;
  let liveIndex = 0;
  let pointerId = null;
  let pointerCaptured = false;

  sidebarMenu.addEventListener('pointerdown', e => {
    if (!isMobileLayout() || e.pointerType !== 'mouse') return;
    dragging = false;
    pointerCaptured = false;
    startX = e.clientX;
    startIndex = getActivePanelIndex();
    liveIndex = startIndex;
    pointerId = e.pointerId;
  });

  sidebarMenu.addEventListener('pointermove', e => {
    if (!isMobileLayout() || e.pointerType !== 'mouse' || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;

    if (!dragging && Math.abs(dx) > 6) {
      dragging = true;
      navIndicator.style.transition = 'none';
      try {
        sidebarMenu.setPointerCapture(e.pointerId);
        pointerCaptured = true;
      } catch (_) {}
    }

    if (dragging) {
      const menuW = sidebarMenu.offsetWidth - 8;
      const stepPx = menuW / panelsOrder.length;
      const raw = startIndex + dx / stepPx;
      const clamped = Math.min(Math.max(raw, 0), panelsOrder.length - 1);

      sidebarMenu.style.setProperty('--indicator-index', clamped);
      const snapped = Math.round(clamped);
      if (snapped !== Math.round(liveIndex)) setActiveBtn(snapped);
      liveIndex = clamped;
    }
  });

  function endMouseDrag(e) {
    if (e.pointerType !== 'mouse' || e.pointerId !== pointerId) return;
    if (!dragging) {
      pointerId = null;
      pointerCaptured = false;
      return;
    }
    dragging = false;
    if (pointerCaptured) {
      try { sidebarMenu.releasePointerCapture(pointerId); } catch (_) {}
    }
    pointerId = null;
    pointerCaptured = false;
    const finalIdx = Math.min(Math.max(Math.round(liveIndex), 0), panelsOrder.length - 1);
    switchPanel(panelsOrder[finalIdx], true);
  }

  sidebarMenu.addEventListener('pointerup', endMouseDrag);
  sidebarMenu.addEventListener('pointercancel', endMouseDrag);
}

let swipeStartX = 0;
let swipeStartY = 0;
let swipeOnNav = false;

window.addEventListener('touchstart', e => {
  if (!isMobileLayout()) return;
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
  swipeOnNav = sidebarMenu?.contains(e.target) ?? false;
}, { passive: true });

window.addEventListener('touchend', e => {
  if (!isMobileLayout() || swipeOnNav) return;
  const dx = swipeStartX - e.changedTouches[0].clientX;
  const dy = swipeStartY - e.changedTouches[0].clientY;

  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
    const cur = getActivePanelIndex();
    if (dx > 0 && cur < panelsOrder.length - 1) switchPanel(panelsOrder[cur + 1]);
    else if (dx < 0 && cur > 0) switchPanel(panelsOrder[cur - 1]);
  }
}, { passive: true });