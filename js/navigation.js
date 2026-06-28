const menuButtons = document.querySelectorAll('.menu-btn');
const crudSections = document.querySelectorAll('.crud-section');
const navIndicator = document.querySelector('.nav-indicator');
const sidebarMenu = document.querySelector('.sidebar-menu');
const panelsOrder = Array.from(menuButtons).map(b => b.getAttribute('data-target'));
const BREAKPOINT = 860;
const EASING = 'transform 0.42s cubic-bezier(0.25, 1, 0.5, 1)';

const isMobile = () => window.innerWidth <= BREAKPOINT;
const activeIndex = () => {
  const a = Array.from(crudSections).find(s => s.classList.contains('active'));
  return a ? panelsOrder.indexOf(a.id) : 0;
};
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function setIndicator(index, animate = true) {
  if (!sidebarMenu || !navIndicator) return;
  navIndicator.style.transition = animate ? EASING : 'none';
  sidebarMenu.style.setProperty('--indicator-index', index);
}

function switchPanel(panelId, animate = true) {
  const index = panelsOrder.indexOf(panelId);
  if (index === -1) return;
  menuButtons.forEach((b, i) => b.classList.toggle('active', i === index));
  setIndicator(index, animate);
  crudSections.forEach(s => s.classList.toggle('active', s.id === panelId));
}

menuButtons.forEach(btn =>
  btn.addEventListener('click', e => {
    e.preventDefault();
    switchPanel(btn.getAttribute('data-target'));
  })
);

setTimeout(() => {
  setIndicator(activeIndex(), false);
  requestAnimationFrame(() => { if (navIndicator) navIndicator.style.transition = EASING; });
}, 80);

window.addEventListener('resize', () => setIndicator(activeIndex(), false));

if (sidebarMenu && navIndicator) {
  function calcClamped(startIdx, dx) {
    const step = (sidebarMenu.offsetWidth - 8) / panelsOrder.length;
    return clamp(startIdx + dx / step, 0, panelsOrder.length - 1);
  }

  function onDragMove(clamped, prevLive) {
    sidebarMenu.style.setProperty('--indicator-index', clamped);
    const snapped = Math.round(clamped);
    if (snapped !== Math.round(prevLive))
      menuButtons.forEach((b, i) => b.classList.toggle('active', i === snapped));
  }

  function onDragEnd(liveIndex) {
    switchPanel(panelsOrder[clamp(Math.round(liveIndex), 0, panelsOrder.length - 1)], true);
  }

  let tDragging = false, tStartX = 0, tStartIdx = 0, tLive = 0;

  sidebarMenu.addEventListener('touchstart', e => {
    if (!isMobile()) return;
    tDragging = false;
    tStartX = e.touches[0].clientX;
    tStartIdx = activeIndex();
    tLive = tStartIdx;
  }, { passive: true });

  sidebarMenu.addEventListener('touchmove', e => {
    if (!isMobile()) return;
    const dx = e.touches[0].clientX - tStartX;
    if (!tDragging && Math.abs(dx) > 6) {
      tDragging = true;
      navIndicator.style.transition = 'none';
    }
    if (tDragging) {
      e.preventDefault();
      const next = calcClamped(tStartIdx, dx);
      onDragMove(next, tLive);
      tLive = next;
    }
  }, { passive: false });

  sidebarMenu.addEventListener('touchend', () => {
    if (!isMobile() || !tDragging) return;
    tDragging = false;
    onDragEnd(tLive);
  }, { passive: true });

  let mDragging = false, mStartX = 0, mStartIdx = 0, mLive = 0, mId = null, mCaptured = false;

  sidebarMenu.addEventListener('pointerdown', e => {
    if (!isMobile() || e.pointerType !== 'mouse') return;
    mDragging = false; mCaptured = false;
    mStartX = e.clientX; mStartIdx = activeIndex(); mLive = mStartIdx; mId = e.pointerId;
  });

  sidebarMenu.addEventListener('pointermove', e => {
    if (!isMobile() || e.pointerType !== 'mouse' || e.pointerId !== mId) return;
    const dx = e.clientX - mStartX;
    if (!mDragging && Math.abs(dx) > 6) {
      mDragging = true;
      navIndicator.style.transition = 'none';
      try { sidebarMenu.setPointerCapture(mId); mCaptured = true; } catch (_) {}
    }
    if (mDragging) {
      const next = calcClamped(mStartIdx, dx);
      onDragMove(next, mLive);
      mLive = next;
    }
  });

  function endMouseDrag(e) {
    if (e.pointerType !== 'mouse' || e.pointerId !== mId) return;
    if (mCaptured) try { sidebarMenu.releasePointerCapture(mId); } catch (_) {}
    mId = null; mCaptured = false;
    if (!mDragging) return;
    mDragging = false;
    onDragEnd(mLive);
  }

  sidebarMenu.addEventListener('pointerup', endMouseDrag);
  sidebarMenu.addEventListener('pointercancel', endMouseDrag);
}

let swipeX = 0, swipeY = 0, swipeOnNav = false;

window.addEventListener('touchstart', e => {
  if (!isMobile()) return;
  swipeX = e.touches[0].clientX;
  swipeY = e.touches[0].clientY;
  swipeOnNav = sidebarMenu?.contains(e.target) ?? false;
}, { passive: true });

window.addEventListener('touchend', e => {
  if (!isMobile() || swipeOnNav) return;
  const dx = swipeX - e.changedTouches[0].clientX;
  const dy = swipeY - e.changedTouches[0].clientY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
    const cur = activeIndex();
    if (dx > 0 && cur < panelsOrder.length - 1) switchPanel(panelsOrder[cur + 1]);
    else if (dx < 0 && cur > 0) switchPanel(panelsOrder[cur - 1]);
  }
}, { passive: true });