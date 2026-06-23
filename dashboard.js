/* =====================================================
   LCU FindMe — Dashboard JavaScript (Unique Layout)
   Sidebar-based personalized user portal.
   ===================================================== */

const API_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:'
  ? 'http://127.0.0.1:5000/api'
  : 'https://leadcitylostnfound.onrender.com/api';

// ---- State ----
let state = {
  items: [],
  myItems: [],
  filters: {
    type: 'all',
    category: 'all',
    search: ''
  },
  myFilter: 'all',       // for My Reports tab
  currentView: 'home',   // 'home', 'my-reports', 'browse', 'profile'
  currentUser: null,
  tempUploadedImage: null,
  pendingMatchItem: null,
  pendingVerifEmail: null
};

// SVG Fallback Icons for categories
const categoryIcons = {
  electronics: `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
  documents: `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
  accessories: `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="18" r="4"></circle><path d="M12 18V9.24a6 6 0 1 1 8 0V18"></path><line x1="12" y1="14" x2="20" y2="14"></line></svg>`,
  books: `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5v-15z"></path></svg>`,
  clothing: `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.38 3.46L16 6.14V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2.14L3.62 3.46a2 2 0 0 0-2.41.44l-1 1a2 2 0 0 0-.14 2.5L4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7l3.93-4.6a2 2 0 0 0-.14-2.5l-1-1a2 2 0 0 0-2.41-.44z"></path></svg>`,
  other: `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`
};

// =====================================================
// AUTH CHECK
// =====================================================
function checkAuth() {
  const token = localStorage.getItem('lcu_findme_token');
  const savedUser = localStorage.getItem('lcu_findme_user');
  if (!token || !savedUser) {
    window.location.href = 'index.html?login=required';
    return false;
  }
  state.currentUser = JSON.parse(savedUser);
  return true;
}

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;

  initTheme();
  populateUserUI();
  setupNavigation();
  setupSidebar();
  setupReportModal();
  setupDetailModal();
  setupEditProfile();
  setupNotifications();
  setupOtpModal();

  await loadData();
  checkUrlParams();
});

// =====================================================
// THEME
// =====================================================
function initTheme() {
  const savedTheme = localStorage.getItem('lcu_findme_theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    updateThemeLabel(true);
  }

  const themeBtn = document.getElementById('db-theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      localStorage.setItem('lcu_findme_theme', isDark ? 'dark' : 'light');
      updateThemeLabel(isDark);
    });
  }
}

function updateThemeLabel(isDark) {
  const label = document.getElementById('db-theme-label');
  if (label) label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
}

// =====================================================
// POPULATE USER INFO IN UI
// =====================================================
function populateUserUI() {
  if (!state.currentUser) return;
  const u = state.currentUser;
  const name = u.name || 'Student';
  const initial = name.charAt(0).toUpperCase();
  const role = u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : 'Student';

  // Sidebar
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  const sidebarUsername = document.getElementById('sidebar-username');
  const sidebarRole = document.getElementById('sidebar-role');
  if (sidebarAvatar) sidebarAvatar.textContent = initial;
  if (sidebarUsername) sidebarUsername.textContent = name;
  if (sidebarRole) sidebarRole.textContent = role;

  // Topbar
  const topbarAvatar = document.getElementById('topbar-avatar');
  if (topbarAvatar) topbarAvatar.textContent = initial;

  // Welcome section
  const greetingEl = document.getElementById('welcome-greeting');
  const nameEl = document.getElementById('welcome-name');
  if (greetingEl) greetingEl.textContent = getGreeting() + ',';
  if (nameEl) nameEl.textContent = name.split(' ')[0] + ' 👋';

  // Profile view
  populateProfileView();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function populateProfileView() {
  if (!state.currentUser) return;
  const u = state.currentUser;
  const name = u.name || 'Student';
  const initial = name.charAt(0).toUpperCase();
  const role = u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : 'Student';
  const matric = u.matricNumber || u.matric || '—';

  // Profile card
  const bigAvatar = document.getElementById('profile-big-avatar');
  const nameBig = document.getElementById('profile-name-big');
  const roleBadge = document.getElementById('profile-role-badge');
  const matricDisplay = document.getElementById('profile-matric-display');
  if (bigAvatar) bigAvatar.textContent = initial;
  if (nameBig) nameBig.textContent = name;
  if (roleBadge) roleBadge.textContent = role;
  if (matricDisplay) matricDisplay.textContent = matric;

  // Profile info grid
  const fields = {
    'pinfo-name':    name,
    'pinfo-email':   u.email || u.contact || '—',
    'pinfo-matric':  matric,
    'pinfo-phone':   u.phoneNumber || u.phone || '—',
    'pinfo-faculty': u.faculty || '—',
    'pinfo-dept':    u.department || u.dept || '—',
    'pinfo-level':   u.level ? `${u.level} Level` : '—',
    'pinfo-role':    role
  };
  for (const [id, val] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
}

// =====================================================
// LOAD DATA
// =====================================================
async function loadData() {
  try {
    await fetchItems();
    computeMyItems();
    renderOverview();
    renderMyReportsGrid();
    renderBrowseGrid();
    updateActivityBars();
    renderNotifications();
  } catch (err) {
    console.error('loadData error:', err);
  }
}

async function fetchItems() {
  try {
    const { type, category, search } = state.filters;
    let url = `${API_URL}/items?type=${type}&category=${category}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search)}`;
    const res = await fetch(url);
    if (res.ok) {
      state.items = await res.json();
    }
  } catch (err) {
    console.error('fetchItems error:', err);
  }
}

function computeMyItems() {
  if (!state.currentUser) { state.myItems = []; return; }
  state.myItems = state.items.filter(i => i.reporterName === state.currentUser.name);
}

// =====================================================
// RENDER OVERVIEW (HOME)
// =====================================================
function renderOverview() {
  computeMyItems();
  const myTotal    = state.myItems.length;
  const myLost     = state.myItems.filter(i => i.type === 'lost' && i.status !== 'returned').length;
  const myReturned = state.myItems.filter(i => i.status === 'returned').length;
  const campusAll  = state.items.length;

  animateCounter('my-stat-total',    myTotal);
  animateCounter('my-stat-lost',     myLost);
  animateCounter('my-stat-returned', myReturned);
  animateCounter('my-stat-campus',   campusAll);

  // Mini stats in profile card
  animateCounter('profile-mini-reports',  myTotal);
  animateCounter('profile-mini-returned', myReturned);
  animateCounter('profile-mini-active',   state.myItems.filter(i => i.status !== 'returned').length);

  // My Reports badge in sidebar
  const badge = document.getElementById('my-reports-badge');
  if (badge) {
    const activeCount = state.myItems.filter(i => i.status !== 'returned').length;
    if (activeCount > 0) {
      badge.textContent = activeCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  renderRecentReportsList();
}

function renderRecentReportsList() {
  const listEl = document.getElementById('db-recent-reports-list');
  if (!listEl) return;

  const recent = [...state.myItems]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (recent.length === 0) {
    listEl.innerHTML = `
      <div class="db-empty-mini">
        <span>📋</span>
        <p>You haven't submitted any reports yet.</p>
        <button class="db-btn-sm" id="btn-report-empty">Report Your First Item</button>
      </div>`;
    const btnEmpty = document.getElementById('btn-report-empty');
    if (btnEmpty) btnEmpty.addEventListener('click', openReportModal);
    return;
  }

  listEl.innerHTML = recent.map(item => {
    const isFound = item.type === 'found';
    const icon = isFound ? '📦' : '🔍';
    const iconClass = isFound ? 'type-found' : 'type-lost';
    const statusText = item.status === 'returned' ? 'Returned' : (isFound ? 'Found' : 'Lost');
    const statusClass = item.status === 'returned' ? 'db-status-returned' : (isFound ? 'db-status-active' : 'db-status-lost');
    return `
      <div class="db-report-row" data-item-id="${item._id || item.id}">
        <div class="db-report-icon ${iconClass}">${icon}</div>
        <div class="db-report-info">
          <div class="db-report-name">${item.title}</div>
          <div class="db-report-meta">${formatDate(item.date)} · ${item.location}</div>
        </div>
        <span class="db-report-status ${statusClass}">${statusText}</span>
      </div>`;
  }).join('');

  listEl.querySelectorAll('.db-report-row').forEach(row => {
    row.addEventListener('click', () => openDetailModal(row.dataset.itemId));
  });
}

function updateActivityBars() {
  const total    = state.items.length || 1; // avoid division by zero
  const found    = state.items.filter(i => i.type === 'found').length;
  const lost     = state.items.filter(i => i.type === 'lost').length;
  const returned = state.items.filter(i => i.status === 'returned').length;

  const max = Math.max(found, lost, returned, 1);

  setBar('bar-found',    (found / max) * 100,    'count-found',    found);
  setBar('bar-lost',     (lost / max) * 100,     'count-lost',     lost);
  setBar('bar-returned', (returned / max) * 100, 'count-returned', returned);
}

function setBar(barId, pct, countId, count) {
  const bar = document.getElementById(barId);
  const cnt = document.getElementById(countId);
  if (bar) setTimeout(() => { bar.style.width = `${Math.round(pct)}%`; }, 100);
  if (cnt) cnt.textContent = count;
}

// =====================================================
// RENDER MY REPORTS GRID
// =====================================================
function renderMyReportsGrid() {
  const grid = document.getElementById('db-my-reports-grid');
  if (!grid) return;

  let filtered = [...state.myItems];
  if (state.myFilter !== 'all') {
    if (state.myFilter === 'returned') {
      filtered = filtered.filter(i => i.status === 'returned');
    } else {
      filtered = filtered.filter(i => i.type === state.myFilter && i.status !== 'returned');
    }
  }

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="db-full-empty">
        <div class="db-full-empty-icon">📋</div>
        <h3>No reports found</h3>
        <p>You haven't submitted any ${state.myFilter !== 'all' ? state.myFilter : ''} reports yet.</p>
        <button class="db-btn-sm" id="btn-empty-report-2">Report an Item</button>
      </div>`;
    const btn = document.getElementById('btn-empty-report-2');
    if (btn) btn.addEventListener('click', openReportModal);
    return;
  }

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(item => grid.appendChild(buildItemCard(item)));
}

// =====================================================
// RENDER BROWSE GRID
// =====================================================
function renderBrowseGrid() {
  const grid = document.getElementById('db-browse-grid');
  if (!grid) return;

  grid.innerHTML = '';

  let filtered = [...state.items];

  if (state.filters.type !== 'all') {
    filtered = filtered.filter(i => i.type === state.filters.type);
  }
  if (state.filters.category !== 'all') {
    filtered = filtered.filter(i => i.category === state.filters.category);
  }

  filtered.sort((a, b) => {
    if (a.status === 'returned' && b.status !== 'returned') return 1;
    if (a.status !== 'returned' && b.status === 'returned') return -1;
    return new Date(b.date) - new Date(a.date);
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="db-full-empty">
        <div class="db-full-empty-icon">🔍</div>
        <h3>No Items Found</h3>
        <p>No listings match your current filters. Try adjusting your search.</p>
      </div>`;
    return;
  }

  filtered.forEach(item => grid.appendChild(buildItemCard(item)));
}

// =====================================================
// BUILD ITEM CARD (shared between My Reports + Browse)
// =====================================================
function buildItemCard(item) {
  const card = document.createElement('div');
  card.className = `item-card ${item.status === 'returned' ? 'item-returned' : ''}`;
  card.setAttribute('data-id', item._id || item.id);

  let imageHTML = '';
  if (item.image && item.image.startsWith('data:image')) {
    imageHTML = `<img src="${item.image}" alt="${item.title}">`;
  } else {
    const icon = categoryIcons[item.category] || categoryIcons['other'];
    imageHTML = `<div class="placeholder-illustration">${icon}<div class="placeholder-text">${item.category}</div></div>`;
  }

  const badgeText  = item.status === 'returned' ? 'Returned' : (item.type === 'found' ? 'Found' : 'Lost');
  const badgeClass = item.status === 'returned' ? 'badge-found' : (item.type === 'found' ? 'badge-found' : 'badge-lost');

  let matchBadge = '';
  if (item.status === 'active') {
    const match = findPotentialMatches(item);
    if (match) matchBadge = `<span class="card-badge badge-matched">✨ Matched</span>`;
  }

  card.innerHTML = `
    <div class="card-image-area" style="${item.status === 'returned' ? 'opacity:0.65' : ''}">
      <span class="card-badge ${badgeClass}">${badgeText}</span>
      ${matchBadge}
      ${imageHTML}
    </div>
    <div class="card-content" style="${item.status === 'returned' ? 'opacity:0.75' : ''}">
      <div class="card-meta">
        <span>${formatDate(item.date)}</span>
        <span class="meta-dot"></span>
        <span style="text-transform:capitalize">${item.category}</span>
      </div>
      <h3 class="card-title">${item.title}</h3>
      <p class="card-description">${item.description}</p>
      <div class="card-footer">
        <div class="card-location">
          <span class="card-location-icon">📍</span>
          <span>${item.location}</span>
        </div>
        <button class="btn btn-secondary btn-detail-trigger" style="padding:0.4rem 0.9rem;font-size:0.8rem;">
          ${item.status === 'returned' ? 'View Details' : 'Verify & Claim'}
        </button>
      </div>
    </div>`;

  card.querySelector('.btn-detail-trigger').addEventListener('click', e => {
    e.stopPropagation();
    openDetailModal(item._id || item.id);
  });
  card.addEventListener('click', () => openDetailModal(item._id || item.id));
  return card;
}

// =====================================================
// NAVIGATION
// =====================================================
function setupNavigation() {
  // Navigation items
  const navItems = document.querySelectorAll('.db-nav-item[data-view]');
  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
      closeSidebar();
    });
  });

  // Report button in header
  const navReportBtn = document.getElementById('db-nav-report-btn');
  if (navReportBtn) {
    navReportBtn.addEventListener('click', e => {
      e.preventDefault();
      openReportModal();
      closeSidebar();
    });
  }

  // Logout buttons
  const logoutBtns = document.querySelectorAll('.db-logout-btn');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentUser = null;
      localStorage.removeItem('lcu_findme_token');
      localStorage.removeItem('lcu_findme_user');
      showToast('You have securely logged out.');
      setTimeout(() => { window.location.href = 'index.html'; }, 1000);
    });
  });

  // Welcome page CTA
  const ctaBtn = document.getElementById('btn-report-cta');
  if (ctaBtn) ctaBtn.addEventListener('click', openReportModal);

  // My Reports — report button
  const myReportsReportBtn = document.getElementById('btn-report-my-reports');
  if (myReportsReportBtn) myReportsReportBtn.addEventListener('click', openReportModal);

  // Quick actions
  const actionReport = document.getElementById('btn-action-report');
  if (actionReport) actionReport.addEventListener('click', openReportModal);

  const actionBrowse = document.getElementById('btn-action-browse');
  if (actionBrowse) actionBrowse.addEventListener('click', () => switchView('browse'));

  const actionProfile = document.getElementById('btn-action-profile');
  if (actionProfile) actionProfile.addEventListener('click', () => switchView('profile'));

  const actionMyReports = document.getElementById('btn-action-myreports');
  if (actionMyReports) actionMyReports.addEventListener('click', () => switchView('my-reports'));

  // Overview: "View All" my reports link
  const linkViewAll = document.getElementById('link-view-all-reports');
  if (linkViewAll) {
    linkViewAll.addEventListener('click', e => {
      e.preventDefault();
      switchView('my-reports');
    });
  }

  // Edit Profile button in profile view
  const btnEditProfileView = document.getElementById('btn-edit-profile-view');
  if (btnEditProfileView) {
    btnEditProfileView.addEventListener('click', openEditProfile);
  }

  // User Dropdown toggle
  const avatarBtn = document.getElementById('db-avatar-btn');
  const dropdownMenu = document.getElementById('db-user-dropdown-menu');
  if (avatarBtn && dropdownMenu) {
    avatarBtn.addEventListener('click', e => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      dropdownMenu.classList.remove('open');
    });
  }

  // Dropdown profile button
  const dropdownProfileBtn = document.getElementById('db-dropdown-profile-btn');
  if (dropdownProfileBtn) {
    dropdownProfileBtn.addEventListener('click', e => {
      e.preventDefault();
      switchView('profile');
      if (dropdownMenu) dropdownMenu.classList.remove('open');
    });
  }

  // Browse: Search
  const searchInput = document.getElementById('db-search-input');
  const searchBtn   = document.getElementById('db-search-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      state.filters.search = searchInput ? searchInput.value : '';
      fetchItems().then(() => { computeMyItems(); renderBrowseGrid(); });
    });
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') searchBtn.click();
    });
  }

  // Browse: Type filter chips
  document.querySelectorAll('[data-type]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-type]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filters.type = chip.dataset.type;
      renderBrowseGrid();
    });
  });

  // Browse: Category chips
  document.querySelectorAll('.db-cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.db-cat-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filters.category = chip.dataset.category;
      renderBrowseGrid();
    });
  });

  // My Reports: Filter chips
  document.querySelectorAll('[data-my-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-my-filter]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.myFilter = chip.dataset.myFilter;
      renderMyReportsGrid();
    });
  });
}

// ---- Switch view ----
const viewTitles = {
  home:        'Overview',
  'my-reports': 'My Reports',
  browse:      'Browse Listings',
  profile:     'My Profile'
};

function switchView(viewName) {
  // Deactivate all views
  document.querySelectorAll('.db-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.db-nav-item[data-view]').forEach(n => n.classList.remove('active'));

  // Activate target view
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.add('active');

  const targetNavs = document.querySelectorAll(`.db-nav-item[data-view="${viewName}"]`);
  targetNavs.forEach(n => n.classList.add('active'));

  // Update dropdown active link if any
  const dropdownProfileBtn = document.getElementById('db-dropdown-profile-btn');
  if (dropdownProfileBtn) {
    if (viewName === 'profile') {
      dropdownProfileBtn.classList.add('active');
    } else {
      dropdownProfileBtn.classList.remove('active');
    }
  }

  state.currentView = viewName;

  // Re-render on switch to ensure fresh data
  if (viewName === 'home') renderOverview();
  if (viewName === 'my-reports') renderMyReportsGrid();
  if (viewName === 'browse') renderBrowseGrid();
  if (viewName === 'profile') populateProfileView();
}

// =====================================================
// SIDEBAR TOGGLE (Mobile)
// =====================================================
function setupSidebar() {
  const hamburger = document.getElementById('db-hamburger');
  const navTop    = document.getElementById('db-nav-top');
  const overlay   = document.getElementById('db-overlay');

  if (hamburger && navTop) {
    hamburger.addEventListener('click', () => {
      navTop.classList.toggle('open');
      if (overlay) overlay.classList.toggle('visible');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }
}

function closeSidebar() {
  const navTop = document.getElementById('db-nav-top');
  const overlay = document.getElementById('db-overlay');
  if (navTop) navTop.classList.remove('open');
  if (overlay) overlay.classList.remove('visible');
}

// =====================================================
// AUTO MATCH ENGINE
// =====================================================
function findPotentialMatches(newReport) {
  const tokens = newReport.title.toLowerCase()
    .replace(/[^\w\s]/g, '').split(/\s+/).filter(t => t.length >= 3);
  if (!tokens.length) return null;
  const targetType = newReport.type === 'lost' ? 'found' : 'lost';
  for (const item of state.items) {
    if (item.status === 'active' && item.type === targetType && item.category === newReport.category) {
      const itemTokens = item.title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
      if (tokens.some(t => itemTokens.includes(t))) return item;
    }
  }
  return null;
}

// =====================================================
// ITEM DETAIL MODAL
// =====================================================
function setupDetailModal() {
  const btnClose = document.getElementById('btn-close-detail');
  if (btnClose) btnClose.addEventListener('click', () => toggleModal('modal-detail', false));

  const qrClose = document.getElementById('btn-close-qr');
  if (qrClose) qrClose.addEventListener('click', () => toggleModal('modal-qr', false));

  const matchClose = document.getElementById('btn-close-match');
  if (matchClose) matchClose.addEventListener('click', () => toggleModal('modal-match', false));

  const matchIgnore = document.getElementById('btn-match-ignore');
  if (matchIgnore) {
    matchIgnore.addEventListener('click', () => {
      toggleModal('modal-match', false);
      state.pendingMatchItem = null;
      loadData();
    });
  }

  const matchView = document.getElementById('btn-match-view');
  if (matchView) {
    matchView.addEventListener('click', () => {
      const m = state.pendingMatchItem;
      toggleModal('modal-match', false);
      state.pendingMatchItem = null;
      if (m) openDetailModal(m._id || m.id);
      loadData();
    });
  }

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) toggleModal(backdrop.id, false);
    });
  });

  // Print QR
  const btnPrintQR = document.getElementById('btn-print-qr');
  if (btnPrintQR) {
    btnPrintQR.addEventListener('click', () => {
      const qrCanvas = document.getElementById('qr-canvas');
      const qrImg = qrCanvas.toDataURL('image/png');
      const pw = window.open('', '_blank');
      pw.document.write(`<html><head><title>Print Secure Bin Tag</title>
        <style>body{font-family:Inter,sans-serif;display:flex;justify-content:center;align-items:center;min-height:90vh;margin:0;}
        #lbl{border:2px solid #0f172a;padding:1.5rem;border-radius:8px;color:#0f172a;width:380px;}
        h2{font-size:1.25rem;border-bottom:2px solid #0f172a;padding-bottom:.5rem;margin:0 0 .75rem;display:flex;justify-content:space-between;}</style></head>
        <body><div id="lbl"><h2><span>LCU FindMe</span><span style="font-size:.85rem;font-weight:normal;align-self:center">SECURE LABEL</span></h2>
        <div style="display:flex;gap:1.5rem;align-items:center;">
        <img src="${qrImg}" style="width:120px;height:120px;border:1px solid #e2e8f0;border-radius:4px">
        <div style="font-size:.82rem;line-height:1.6;display:flex;flex-direction:column;gap:.4rem;padding-left:.5rem">
        <div style="font-weight:bold">${document.getElementById('qr-label-title').textContent}</div>
        <div>ID: <span style="font-family:monospace;font-weight:700">${document.getElementById('qr-label-id').textContent}</span></div>
        <div>Category: ${document.getElementById('qr-label-category').textContent}</div>
        <div>Location: ${document.getElementById('qr-label-location').textContent}</div>
        <div style="margin-top:.5rem;font-weight:bold;border:1px dashed #0f172a;padding:.3rem .5rem;text-align:center;border-radius:4px">🔒 Bin Tag Required</div>
        </div></div></div>
        <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
        </body></html>`);
      pw.document.close();
    });
  }
}

function openDetailModal(itemId) {
  const item = state.items.find(i => (i._id || i.id) === itemId);
  if (!item) return;

  const detailBody = document.getElementById('detail-body');
  const titleEl    = document.getElementById('detail-title');
  if (titleEl) titleEl.textContent = item.title;
  if (!detailBody) return;

  let imageHTML = '';
  if (item.image && item.image.startsWith('data:image')) {
    imageHTML = `<img src="${item.image}" alt="${item.title}">`;
  } else {
    const icon = categoryIcons[item.category] || categoryIcons['other'];
    imageHTML = `<div class="placeholder-illustration">${icon}<div class="placeholder-text" style="font-size:1rem;margin-top:.5rem">${item.category}</div></div>`;
  }

  let actionSection = '';
  if (item.status === 'returned') {
    actionSection = `<div class="verification-box claimed"><div class="verification-title">🎉 Item Successfully Returned</div>
      <p>This item has been successfully claimed by its rightful owner after passing verification checks.</p></div>`;
  } else if (item.type === 'found') {
    actionSection = `<div class="verification-box" id="claim-verification-section">
      <div class="verification-title">📍 LCU In-Person Claim Verification</div>
      <p style="font-size:.88rem;margin-bottom:.75rem">To retrieve this found item, please visit the <strong>LCU Security Office (Senate Building)</strong> in person.</p>
      <div style="background-color:var(--bg-tertiary);padding:.75rem;border-radius:var(--radius-sm);border-left:3px solid var(--primary);margin-bottom:1rem;font-size:.8rem">
        <strong>Security Office Hours:</strong> 8:00 AM - 5:00 PM (Monday - Friday)
      </div>
      <button class="btn btn-primary" id="btn-start-claim" style="width:100%;justify-content:center">Notify Security I'm Coming to Claim</button>
    </div>`;
  } else {
    actionSection = `<div class="verification-box" style="background-color:var(--primary-light);border-color:rgba(37,99,235,.2)">
      <div class="verification-title">🙋 Did you find this item?</div>
      <p>If you found this item or have information, please reach out to the reporter.</p>
      <div style="background:white;padding:1rem;border-radius:var(--radius-md);border:1px solid var(--border-color)">
        <div style="font-size:.85rem;color:var(--text-muted)">Reporter</div>
        <div style="font-weight:700;color:var(--secondary);margin-bottom:.5rem">${item.reporterName}</div>
        <div style="font-size:.85rem;color:var(--text-muted)">Contact Details</div>
        <div style="font-family:monospace;font-weight:600;color:var(--primary)">${item.reporterContact}</div>
      </div>
    </div>`;
  }

  detailBody.innerHTML = `
    <div class="detail-layout">
      <div class="detail-image">${imageHTML}</div>
      <div>
        <h2 style="font-size:1.5rem;margin-bottom:.5rem">${item.title}</h2>
        <div class="detail-info-row">
          <div class="info-item"><h4>Encountered Location</h4><p>📍 ${item.location}</p></div>
          <div class="info-item"><h4>Date Logged</h4><p>📅 ${formatDate(item.date)}</p></div>
          <div class="info-item"><h4>Reported By</h4><p>👤 ${item.reporterName}</p></div>
          <div class="info-item"><h4>Item Category</h4><p style="text-transform:capitalize">📦 ${item.category}</p></div>
        </div>
      </div>
      <div>
        <h3 style="font-size:1.1rem;margin-bottom:.5rem;border-bottom:1px solid var(--border-color);padding-bottom:.25rem">Description</h3>
        <p class="detail-description">${item.description}</p>
      </div>
      ${actionSection}
      ${item.type === 'found' && item.status !== 'returned' ? `
        <button class="btn btn-secondary" id="btn-generate-tag-qr" style="width:100%;justify-content:center;gap:.5rem;margin-top:1rem">
          🖨️ Create Security Tag QR Label
        </button>` : ''}
    </div>`;

  toggleModal('modal-detail', true);

  // QR Generation
  const btnQR = document.getElementById('btn-generate-tag-qr');
  if (btnQR) {
    btnQR.addEventListener('click', () => {
      document.getElementById('qr-label-title').textContent    = item.title;
      document.getElementById('qr-label-id').textContent       = item._id || item.id;
      document.getElementById('qr-label-category').textContent = item.category;
      document.getElementById('qr-label-location').textContent = item.location;
      const canvas = document.getElementById('qr-canvas');
      const origin = window.location.origin !== 'null' ? window.location.origin : 'https://lcufindme.edu.ng';
      let path = window.location.pathname;
      if (path.endsWith('dashboard.html') || path.endsWith('index.html')) {
        path = path.substring(0, path.lastIndexOf('/')) + '/slip.html';
      } else if (path.endsWith('/')) {
        path += 'slip.html';
      } else {
        path = '/slip.html';
      }
      const itemUrl = `${origin}${path}?item=${item._id || item.id}`;
      if (window.QRCode) window.QRCode.draw(itemUrl, canvas, { size: 120, margin: 5, color: '#0f172a' });
      toggleModal('modal-qr', true);
    });
  }

  // Start Claim
  const btnClaim = document.getElementById('btn-start-claim');
  if (btnClaim) {
    btnClaim.addEventListener('click', () => {
      const section = document.getElementById('claim-verification-section');
      if (!section) return;
      const defName   = state.currentUser ? (state.currentUser.name || '') : '';
      const defMatric = state.currentUser ? (state.currentUser.matricNumber || state.currentUser.email || '') : '';
      section.innerHTML = `
        <div class="verification-title" style="margin-bottom:.5rem">📍 LCU In-Person Claim Verification</div>
        <p style="font-size:.82rem;margin-bottom:.75rem;color:var(--text-muted)">Enter your details to verify ownership before visiting the Security Office.</p>
        <form id="claim-details-form" style="display:flex;flex-direction:column;gap:.75rem;text-align:left">
          <div class="form-group">
            <label class="form-label" style="font-size:.8rem;margin-bottom:.25rem;display:block;font-weight:600">Claimant Name</label>
            <input type="text" class="form-control" id="claim-claimant-name" value="${defName}" required>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:.8rem;margin-bottom:.25rem;display:block;font-weight:600">Matric Number / Email</label>
            <input type="text" class="form-control" id="claim-claimant-matric" value="${defMatric}" required>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:.8rem;margin-bottom:.25rem;display:block;font-weight:600">Verification Details</label>
            <textarea class="form-control" id="claim-claimant-details" placeholder="Describe unique characteristics, passcode, or other proof..." style="min-height:80px;resize:vertical" required></textarea>
          </div>
          <div style="display:flex;gap:.5rem;margin-top:.5rem">
            <button type="button" class="btn btn-secondary" id="btn-cancel-claim" style="flex:1;justify-content:center;font-size:.85rem;padding:.5rem">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-claim-form" style="flex:2;justify-content:center;font-size:.85rem;padding:.5rem">Submit Claim Request</button>
          </div>
        </form>`;
      document.getElementById('btn-cancel-claim').addEventListener('click', () => openDetailModal(item._id || item.id));
      document.getElementById('claim-details-form').addEventListener('submit', async e => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit-claim-form');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }
        const claimantName   = document.getElementById('claim-claimant-name').value.trim();
        const claimantMatric = document.getElementById('claim-claimant-matric').value.trim();
        const claimDetails   = document.getElementById('claim-claimant-details').value.trim();
        try {
          const token = localStorage.getItem('lcu_findme_token');
          const res = await fetch(`${API_URL}/items/${item._id}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ claimantName, claimantMatric, claimDetails })
          });
          if (res.ok) {
            toggleModal('modal-detail', false);
            loadData();
            showToast('Verification claim submitted to Security successfully.');
          } else {
            const d = await res.json().catch(() => ({}));
            showToast(d.message || 'Failed to submit claim.', 'error');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Claim Request'; }
          }
        } catch (err) {
          showToast('Connection error. Please try again.', 'error');
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Claim Request'; }
        }
      });
    });
  }
}

// =====================================================
// REPORT MODAL
// =====================================================
let selectedReportType = 'found';

function setupReportModal() {
  const btnClose = document.getElementById('btn-close-report');
  if (btnClose) btnClose.addEventListener('click', () => toggleModal('modal-report', false));

  const typeFound = document.getElementById('type-select-found');
  const typeLost  = document.getElementById('type-select-lost');
  if (typeFound && typeLost) {
    typeFound.addEventListener('click', () => {
      selectedReportType = 'found';
      typeFound.classList.add('active');
      typeLost.classList.remove('active');
      document.getElementById('report-modal-title').textContent = 'Report Found Item';
    });
    typeLost.addEventListener('click', () => {
      selectedReportType = 'lost';
      typeLost.classList.add('active');
      typeFound.classList.remove('active');
      document.getElementById('report-modal-title').textContent = 'Report Lost Item';
    });
  }

  // Map Toggle
  const mapToggleBtn = document.getElementById('btn-toggle-map');
  const mapContainer  = document.getElementById('map-container');
  if (mapToggleBtn && mapContainer) {
    mapToggleBtn.addEventListener('click', () => {
      const hidden = mapContainer.style.display === 'none';
      mapContainer.style.display = hidden ? 'block' : 'none';
      mapToggleBtn.textContent = hidden ? '❌ Hide Interactive Map' : '🗺️ Use Interactive Campus Map';
    });
  }

  // Map Building Selector
  document.querySelectorAll('.map-building').forEach(b => {
    b.addEventListener('click', () => {
      const name = b.dataset.name;
      const loc  = document.getElementById('report-location');
      if (loc) loc.value = name;
      showToast(`Selected "${name}" on map.`);
      document.querySelectorAll('.map-building rect').forEach(r => r.setAttribute('fill', '#eff6ff'));
      b.querySelector('rect').setAttribute('fill', '#dbeafe');
    });
  });

  // File Upload
  const uploadZone = document.getElementById('upload-zone');
  const fileInput  = document.getElementById('file-input');
  const previewContainer = document.getElementById('preview-container');
  const previewImage = document.getElementById('preview-image');
  const btnRemove  = document.getElementById('btn-remove-preview');

  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', e => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handleImageFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', e => {
      if (e.target.files.length > 0) handleImageFile(e.target.files[0]);
    });
  }

  if (btnRemove) {
    btnRemove.addEventListener('click', () => {
      state.tempUploadedImage = null;
      if (previewContainer) previewContainer.style.display = 'none';
      if (uploadZone) uploadZone.style.display = 'block';
      if (fileInput) fileInput.value = '';
    });
  }

  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) { showToast('Please upload an image file.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_W = 400;
        const scale = MAX_W / img.width;
        canvas.width = MAX_W;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const b64 = canvas.toDataURL('image/jpeg', 0.7);
        state.tempUploadedImage = b64;
        if (previewImage) previewImage.src = b64;
        if (uploadZone) uploadZone.style.display = 'none';
        if (previewContainer) previewContainer.style.display = 'block';
        if (document.getElementById('report-category').value === 'documents') {
          runOcrSimulation();
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function runOcrSimulation() {
    showToast('🔎 Scanning document with AI OCR Engine...', 'info');
    setTimeout(() => {
      showToast('✨ OCR scan successful. Autopopulating details.', 'success');
      const titleInput = document.getElementById('report-title');
      const descTA     = document.getElementById('report-description');
      if (titleInput && !titleInput.value.trim()) titleInput.value = 'Student ID Card - Oluwaseun Alabi';
      if (descTA) {
        let cur = descTA.value;
        if (cur.trim()) cur += '\n\n';
        descTA.value = cur + `[AI OCR SCAN DETAILS]\nDetected Owner: Oluwaseun Alabi\nMatric No: LCU/UG/23/10294\nDocument Type: LCU Student ID Card`;
      }
    }, 1500);
  }

  // Report Submit
  const formReport = document.getElementById('form-report');
  if (formReport) {
    formReport.addEventListener('submit', async e => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-report');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

      const data = {
        title:           document.getElementById('report-title').value.trim(),
        category:        document.getElementById('report-category').value,
        location:        document.getElementById('report-location').value.trim(),
        date:            document.getElementById('report-date').value,
        reporterName:    document.getElementById('report-reporter').value.trim(),
        reporterContact: document.getElementById('report-contact').value.trim(),
        description:     document.getElementById('report-description').value.trim(),
        type:            selectedReportType,
        image:           state.tempUploadedImage
      };

      try {
        const token = localStorage.getItem('lcu_findme_token');
        const res = await fetch(`${API_URL}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(data)
        });
        const respData = await res.json();
        if (res.ok) {
          toggleModal('modal-report', false);
          showToast(`Report logged successfully as ${selectedReportType.toUpperCase()}.`);
          await loadData();
          const match = findPotentialMatches(respData);
          if (match) {
            state.pendingMatchItem = match;
            document.getElementById('match-results-container').innerHTML = `
              <div class="item-card" style="margin-top:.5rem;width:100%">
                <div class="card-content">
                  <div class="card-meta">
                    <span>${formatDate(match.date)}</span>
                    <span class="meta-dot"></span>
                    <span style="text-transform:capitalize">${match.category}</span>
                  </div>
                  <h3 class="card-title">${match.title}</h3>
                  <p class="card-description">${match.description}</p>
                  <div style="font-size:.8rem;margin-top:.5rem;color:var(--primary);font-weight:600">📍 ${match.location}</div>
                </div>
              </div>`;
            setTimeout(() => toggleModal('modal-match', true), 800);
          }
        } else {
          showToast(respData.message || 'Failed to submit report.', 'error');
        }
      } catch (err) {
        showToast('Connection error. Please try again.', 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Report'; }
      }
    });
  }
}

function openReportModal() {
  const form = document.getElementById('form-report');
  if (form) form.reset();
  state.tempUploadedImage = null;
  const preview = document.getElementById('preview-container');
  const zone    = document.getElementById('upload-zone');
  if (preview) preview.style.display = 'none';
  if (zone) zone.style.display = 'block';
  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById('report-date');
  if (dateEl) dateEl.value = today;
  if (state.currentUser) {
    const reporterEl = document.getElementById('report-reporter');
    const contactEl  = document.getElementById('report-contact');
    if (reporterEl) reporterEl.value = state.currentUser.name || '';
    if (contactEl)  contactEl.value  = state.currentUser.phoneNumber || state.currentUser.phone || '';
  }
  toggleModal('modal-report', true);
}

// =====================================================
// EDIT PROFILE MODAL
// =====================================================
function setupEditProfile() {
  const btnClose = document.getElementById('btn-close-edit-profile');
  if (btnClose) btnClose.addEventListener('click', () => toggleModal('modal-edit-profile', false));

  const form = document.getElementById('form-edit-profile');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const newName    = document.getElementById('edit-profile-name').value.trim();
      const newContact = document.getElementById('edit-profile-contact').value.trim();
      if (newName && state.currentUser) {
        state.currentUser.name         = newName;
        state.currentUser.email        = newContact;
        state.currentUser.contact      = newContact;
        state.currentUser.matricNumber = document.getElementById('edit-profile-matric').value.trim();
        state.currentUser.matric       = state.currentUser.matricNumber;
        state.currentUser.department   = document.getElementById('edit-profile-dept').value.trim();
        state.currentUser.dept         = state.currentUser.department;
        state.currentUser.phoneNumber  = document.getElementById('edit-profile-phone').value.trim();
        state.currentUser.phone        = state.currentUser.phoneNumber;
        localStorage.setItem('lcu_findme_user', JSON.stringify(state.currentUser));
        populateUserUI();
        toggleModal('modal-edit-profile', false);
        showToast('Profile updated successfully.');
      }
    });
  }
}

function openEditProfile() {
  if (!state.currentUser) return;
  const u = state.currentUser;
  const nameEl   = document.getElementById('edit-profile-name');
  const contactEl = document.getElementById('edit-profile-contact');
  const matricEl  = document.getElementById('edit-profile-matric');
  const deptEl    = document.getElementById('edit-profile-dept');
  const phoneEl   = document.getElementById('edit-profile-phone');
  const avatarEl  = document.getElementById('edit-avatar-preview');
  if (nameEl)    nameEl.value   = u.name || '';
  if (contactEl) contactEl.value = u.email || u.contact || '';
  if (matricEl)  matricEl.value  = u.matricNumber || u.matric || '';
  if (deptEl)    deptEl.value    = u.department || u.dept || '';
  if (phoneEl)   phoneEl.value   = u.phoneNumber || u.phone || '';
  if (avatarEl)  avatarEl.textContent = (u.name || 'U').charAt(0).toUpperCase();
  if (nameEl) {
    nameEl.addEventListener('input', () => {
      if (avatarEl) avatarEl.textContent = (nameEl.value || 'U').charAt(0).toUpperCase();
    });
  }
  toggleModal('modal-edit-profile', true);
}

// =====================================================
// OTP MODAL
// =====================================================
function setupOtpModal() {
  const btnClose = document.getElementById('btn-close-otp');
  if (btnClose) btnClose.addEventListener('click', () => toggleModal('modal-otp', false));

  const otpInputs     = document.querySelectorAll('.otp-digit-input');
  const hiddenOtpCode = document.getElementById('otp-code');
  if (otpInputs.length && hiddenOtpCode) {
    const updateHidden = () => {
      let code = '';
      otpInputs.forEach(i => code += i.value);
      hiddenOtpCode.value = code;
    };
    otpInputs.forEach((input, idx) => {
      input.addEventListener('focus', () => input.select());
      input.addEventListener('input', e => {
        const clean = e.target.value.replace(/\D/g, '');
        e.target.value = clean.slice(-1);
        if (e.target.value && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
        updateHidden();
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Backspace') {
          if (!input.value && idx > 0) { otpInputs[idx - 1].value = ''; otpInputs[idx - 1].focus(); }
          else input.value = '';
          updateHidden(); e.preventDefault();
        } else if (e.key === 'ArrowLeft' && idx > 0) { otpInputs[idx - 1].focus(); e.preventDefault(); }
        else if (e.key === 'ArrowRight' && idx < otpInputs.length - 1) { otpInputs[idx + 1].focus(); e.preventDefault(); }
      });
      input.addEventListener('paste', e => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text').trim();
        if (/^\d{6}$/.test(text)) {
          otpInputs.forEach((inp, i) => { inp.value = text[i]; });
          otpInputs[5].focus();
          updateHidden();
        }
      });
    });
  }

  const formOtp = document.getElementById('form-verify-otp');
  if (formOtp) {
    formOtp.addEventListener('submit', async e => {
      e.preventDefault();
      const otp    = document.getElementById('otp-code').value.trim();
      const email  = state.pendingVerifEmail;
      const errMsg = document.getElementById('otp-error-msg');
      const btn    = document.getElementById('btn-verify-otp');
      if (!email) { if (errMsg) { errMsg.textContent = 'Session expired. Please try again.'; errMsg.style.display = 'block'; } return; }
      if (btn) { btn.disabled = true; btn.textContent = 'Verifying...'; }
      try {
        const res  = await fetch(`${API_URL}/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp }) });
        const data = await res.json();
        if (res.ok) {
          toggleModal('modal-otp', false);
          state.currentUser = data.user;
          localStorage.setItem('lcu_findme_token', data.token);
          localStorage.setItem('lcu_findme_user', JSON.stringify(data.user));
          populateUserUI();
          showToast('Email verified successfully!');
          state.pendingVerifEmail = null;
        } else {
          if (errMsg) { errMsg.textContent = data.message || 'Invalid code.'; errMsg.style.display = 'block'; }
        }
      } catch (err) {
        if (errMsg) { errMsg.textContent = 'Connection error.'; errMsg.style.display = 'block'; }
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Verify Account'; }
      }
    });
  }

  const btnResend = document.getElementById('btn-resend-otp');
  if (btnResend) {
    btnResend.addEventListener('click', async () => {
      const email = state.pendingVerifEmail;
      if (!email) { showToast('Session expired.', 'error'); return; }
      btnResend.disabled = true;
      let cd = 60;
      btnResend.textContent = `Resend in ${cd}s`;
      const timer = setInterval(() => {
        cd--;
        btnResend.textContent = `Resend in ${cd}s`;
        if (cd <= 0) { clearInterval(timer); btnResend.disabled = false; btnResend.textContent = "Didn't receive it? Resend Code"; }
      }, 1000);
      try {
        await fetch(`${API_URL}/auth/resend-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        showToast('New verification code sent.');
      } catch (err) {
        showToast('Failed to resend code.', 'error');
      }
    });
  }
}

// =====================================================
// NOTIFICATIONS
// =====================================================
const notifications = JSON.parse(localStorage.getItem('lcu_findme_notifs') || '[]');

function setupNotifications() {
  const bell   = document.getElementById('db-notif-btn');
  const panel  = document.getElementById('db-notif-panel');
  const clear  = document.getElementById('db-clear-notifs');

  if (bell && panel) {
    bell.addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.toggle('open');
      notifications.forEach(n => n.read = true);
      saveNotifs();
      renderNotifications();
    });
  }

  if (clear) {
    clear.addEventListener('click', () => {
      notifications.length = 0;
      saveNotifs();
      renderNotifications();
      if (panel) panel.classList.remove('open');
    });
  }

  document.addEventListener('click', e => {
    if (panel && !panel.contains(e.target) && e.target !== bell) {
      panel.classList.remove('open');
    }
  });

  fetchNotificationsFromServer();
  setInterval(fetchNotificationsFromServer, 15000);
}

async function fetchNotificationsFromServer() {
  if (!state.currentUser) return;
  try {
    const token = localStorage.getItem('lcu_findme_token');
    const res = await fetch(`${API_URL}/items/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) {
      const dbNotifs = await res.json();
      let hasNew = false;
      dbNotifs.forEach(n => {
        if (!notifications.some(e => e.message === n.message)) {
          notifications.unshift({ message: n.message, time: n.time || new Date().toISOString(), read: false });
          hasNew = true;
        }
      });
      if (notifications.length > 20) notifications.length = 20;
      if (hasNew) { saveNotifs(); renderNotifications(); showToast(dbNotifs[0].message, 'info'); }
    }
  } catch (err) {
    console.error('Notification error:', err);
  }
}

function saveNotifs() {
  localStorage.setItem('lcu_findme_notifs', JSON.stringify(notifications));
}

function renderNotifications() {
  const list = document.getElementById('db-notif-list');
  const dot  = document.getElementById('db-notif-dot');
  if (!list) return;

  const unread = notifications.filter(n => !n.read).length;
  if (dot) dot.style.display = unread > 0 ? 'block' : 'none';

  if (notifications.length === 0) {
    list.innerHTML = '<div class="db-notif-empty">No notifications yet.</div>';
    return;
  }

  list.innerHTML = notifications.map((n, i) => {
    const msg = n.message.toLowerCase();
    let icon = '🔔';
    if (msg.includes('approved') || msg.includes('success') || msg.includes('marked')) icon = '✅';
    else if (msg.includes('reject') || msg.includes('fail')) icon = '❌';
    else if (msg.includes('verify') || msg.includes('claim')) icon = '🔒';
    else if (msg.includes('match') || msg.includes('found')) icon = '✨';
    return `<div class="notif-item ${n.read ? '' : 'unread'}" data-index="${i}" style="display:flex;align-items:flex-start;gap:.75rem;padding:.75rem 1rem;border-bottom:1px solid var(--border-color);cursor:pointer">
      <div class="notif-icon-badge" style="font-size:1rem;flex-shrink:0">${icon}</div>
      <div class="notif-content-wrapper" style="flex:1;min-width:0">
        <div style="font-size:.82rem;font-weight:${n.read ? '400' : '600'};color:var(--text-dark);line-height:1.4">${n.message}</div>
        <span style="font-size:.72rem;color:var(--text-muted);margin-top:2px;display:block">${timeAgo(n.time)}</span>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      notifications[idx].read = true;
      saveNotifs();
      renderNotifications();
    });
  });
}

// =====================================================
// URL PARAM HANDLER (QR Slip from scanned QR)
// =====================================================
async function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get('item');
  if (!itemId) return;

  const btnCloseSlip = document.getElementById('btn-close-slip');
  const btnDismiss   = document.getElementById('btn-dismiss-slip');
  const btnPrint     = document.getElementById('btn-print-slip');

  if (btnCloseSlip) btnCloseSlip.addEventListener('click', () => toggleModal('modal-verify-slip', false));
  if (btnDismiss)   btnDismiss.addEventListener('click',   () => toggleModal('modal-verify-slip', false));

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      const slip = document.querySelector('.security-slip').outerHTML;
      const pw = window.open('', '_blank');
      pw.document.write(`<html><head><title>LCU FindMe Security Slip</title>
        <style>body{font-family:Inter,sans-serif;padding:20px;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff}
        .security-slip{border:2px dashed #64748b;border-radius:12px;padding:24px;background:#f8fafc;width:400px}
        strong{color:#0f172a} span{color:#64748b}
        .status-badge{display:inline-flex;padding:.25rem .65rem;border-radius:50px;font-size:.75rem;font-weight:700;text-transform:uppercase}
        .status-active{background:#fffbeb;color:#f59e0b} .status-returned{background:#ecfdf5;color:#10b981}</style></head>
        <body>${slip}<script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`);
      pw.document.close();
    });
  }

  try {
    showToast('Loading security slip details...', 'info');
    const res = await fetch(`${API_URL}/items/${itemId}`);
    if (!res.ok) { showToast('Could not retrieve item details.', 'error'); return; }
    const item = await res.json();

    document.getElementById('slip-ref').textContent      = `REF-${(item._id || '').slice(-8).toUpperCase()}`;
    document.getElementById('slip-title').textContent    = item.title;
    document.getElementById('slip-category').textContent = item.category;
    document.getElementById('slip-location').textContent = item.location;
    document.getElementById('slip-date').textContent     = formatDate(item.date);
    const statusEl = document.getElementById('slip-status');
    if (statusEl) { statusEl.textContent = (item.status || 'FOUND').toUpperCase(); statusEl.className = `status-badge ${item.status === 'returned' ? 'status-returned' : 'status-active'}`; }

    const repTitleEl = document.getElementById('modal-slip-reporter-title');
    if (repTitleEl) repTitleEl.textContent = item.type === 'found' ? 'Founder Credentials' : 'Reporter Credentials';

    const repListEl = document.getElementById('modal-slip-reporter-list');
    if (repListEl) {
      repListEl.innerHTML = [
        ['Name', item.reporterName || 'Anonymous'],
        ['Contact', item.reporterContact || 'Not Provided'],
        item.reporterEmail  ? ['Email', item.reporterEmail]   : null,
        item.reporterMatric ? ['Matric/Staff ID', item.reporterMatric] : null,
        item.reporterFaculty ? ['Faculty', item.reporterFaculty] : null,
        item.reporterDept   ? ['Department', item.reporterDept] : null,
        item.reporterLevel  ? ['Level', `${item.reporterLevel} Level`] : null
      ].filter(Boolean).map(([k, v]) => `
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--text-muted);font-weight:500">${k}:</span>
          <strong style="color:var(--text-dark)">${v}</strong>
        </div>`).join('');
    }

    const accepted = item.verificationClaims && item.verificationClaims.find(c => c.status === 'accepted' || c.resolved);
    const claimBoxEl  = document.getElementById('modal-slip-claimant-box');
    const claimListEl = document.getElementById('modal-slip-claimant-list');
    if (accepted && claimBoxEl && claimListEl) {
      claimBoxEl.style.display = 'block';
      claimListEl.innerHTML = [
        ['Claimer Name', accepted.claimantName],
        ['Matric/Staff ID', accepted.claimantMatric],
        accepted.claimantPhone ? ['Phone', accepted.claimantPhone] : null,
        accepted.claimantEmail ? ['Email', accepted.claimantEmail] : null,
        accepted.claimantFaculty ? ['Faculty', accepted.claimantFaculty] : null,
        accepted.claimantDept  ? ['Department', accepted.claimantDept] : null,
        accepted.claimantLevel ? ['Level', `${accepted.claimantLevel} Level`] : null
      ].filter(Boolean).map(([k, v]) => `
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--text-muted);font-weight:500">${k}:</span>
          <strong style="color:var(--text-dark)">${v}</strong>
        </div>`).join('');
    } else if (claimBoxEl) {
      claimBoxEl.style.display = 'none';
    }

    toggleModal('modal-verify-slip', true);
  } catch (err) {
    showToast('Connection error loading security slip.', 'error');
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown Date';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function toggleModal(modalId, show = true) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  if (show) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const first = modal.querySelector('.otp-digit-input, input:not([type="hidden"]):not([disabled]), select, textarea');
      if (first) first.focus();
    }, 100);
  } else {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function showToast(message, type = 'success') {
  const toast  = document.getElementById('toast-notification');
  const msgEl  = document.getElementById('toast-message');
  const iconEl = toast ? toast.querySelector('.toast-icon') : null;
  if (!toast || !msgEl) return;
  msgEl.textContent = message;
  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
  };
  if (iconEl) iconEl.innerHTML = icons[type] || icons.success;
  toast.classList.remove('active');
  void toast.offsetWidth;
  toast.className = `toast toast-${type} active`;
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => toast.classList.remove('active'), 4000);
}

let counterTimers = {};
function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  if (counterTimers[id]) clearInterval(counterTimers[id]);
  let current = parseInt(el.textContent) || 0;
  if (current === target) return;
  const diff = target - current;
  const step = diff > 0 ? 1 : -1;
  const interval = Math.abs(Math.floor(400 / diff)) || 30;
  counterTimers[id] = setInterval(() => {
    current += step;
    el.textContent = current;
    if (current === target) { clearInterval(counterTimers[id]); delete counterTimers[id]; }
  }, interval);
}

// Render notifications on load
renderNotifications();
