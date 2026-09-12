// ============================================================
// LCU FINDME — CAMPUS SECURITY OPERATIONS CENTER (ADMIN JS)
// ============================================================

const API_URL = window.location.hostname === '127.0.0.1' ||
  window.location.hostname === 'localhost' ||
  window.location.protocol === 'file:'
  ? 'http://127.0.0.1:5000/api'
  : 'https://leadcitylostnfound.onrender.com/api';

const VERIF_LOG_KEY = 'lcu_findme_verif_log';

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Helper: Format Date
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown Date';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Helper: Format Date & Time
function formatDateTime(dateStr) {
  if (!dateStr) return 'Unknown Time';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Local Storage Fallback for Verification Log
function getLocalVerifLog() {
  try { return JSON.parse(localStorage.getItem(VERIF_LOG_KEY) || '[]'); }
  catch { return []; }
}

function saveLocalVerifLog(log) {
  try { localStorage.setItem(VERIF_LOG_KEY, JSON.stringify(log)); }
  catch (e) { console.error('Error saving local verif log:', e); }
}

// ============================================================
// MAIN APPLICATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

  // State
  let adminItems = [];
  let adminUsers = [];
  let adminClaims = [];
  let adminVerifLogs = [];
  let adminAlerts = [];
  let currentTab = 'dashboard';
  let adminName = localStorage.getItem('lcu_findme_admin_name') || 'CSO Olabisi';
  let adminRank = localStorage.getItem('lcu_findme_admin_rank') || 'Chief Security Officer';
  let adminOffice = localStorage.getItem('lcu_findme_admin_office') || 'Gate A Main Desk';
  let html5Scanner = null;
  let scannerRunning = false;
  let currentSelectedItemForSlip = null;

  // ---- THEME INITIALIZATION ----
  const initTheme = () => {
    if (localStorage.getItem('lcu_findme_theme') === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  };
  initTheme();

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      localStorage.setItem('lcu_findme_theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    });
  }

  // ---- MODAL CONTROLS ----
  function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (!el) return;
    if (show) {
      el.classList.add('active');
      document.body.style.overflow = 'hidden';
    } else {
      el.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) {
        if (backdrop.id === 'modal-scanner') stopScanner();
        toggleModal(backdrop.id, false);
      }
    });
    const container = backdrop.querySelector('.modal-container');
    if (container) container.addEventListener('click', e => e.stopPropagation());
  });

  // ---- TOAST NOTIFICATIONS ----
  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    const msgEl = document.getElementById('toast-message');
    const iconEl = toast ? toast.querySelector('.toast-icon') : null;
    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    if (iconEl) {
      if (type === 'success') iconEl.innerHTML = '✓';
      else if (type === 'error') iconEl.innerHTML = '✗';
      else if (type === 'warning') iconEl.innerHTML = '⚠️';
      else if (type === 'info') iconEl.innerHTML = 'ℹ️';
    }

    toast.classList.remove('active');
    void toast.offsetWidth;
    toast.className = `toast toast-${type} active`;

    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
      toast.classList.remove('active');
    }, 4500);
  }

  // ---- AUTHENTICATION & PORTAL ACCESS ----
  const overlay = document.getElementById('admin-login-overlay');
  const appContainer = document.querySelector('.app-container');

  function checkAuthStatus() {
    const storedUser = JSON.parse(localStorage.getItem('lcu_findme_user') || 'null');
    const token = localStorage.getItem('lcu_findme_token');
    if (token && storedUser && storedUser.role === 'admin') {
      unlockPortal();
    } else {
      lockPortal();
    }
  }

  function unlockPortal() {
    if (overlay) overlay.style.display = 'none';
    if (appContainer) appContainer.style.opacity = '1';
    updateAdminHeader();
    loadAllData();
  }

  function lockPortal() {
    if (overlay) overlay.style.display = 'flex';
    if (appContainer) appContainer.style.opacity = '0.08';
  }

  function logoutAdmin() {
    if (!confirm('Are you sure you want to log out and lock the Security Operations Center?')) return;
    localStorage.removeItem('lcu_findme_token');
    localStorage.removeItem('lcu_findme_user');
    showToast('Security session terminated. Portal locked.', 'info');
    lockPortal();
  }

  const btnLogout = document.getElementById('btn-admin-logout');
  if (btnLogout) btnLogout.addEventListener('click', logoutAdmin);

  // Login Form
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const identifier = document.getElementById('admin-login-email').value.trim();
      const password = document.getElementById('admin-login-password').value;
      const errorMsg = document.getElementById('admin-login-error');
      if (errorMsg) errorMsg.style.display = 'none';

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Verifying Security Clearance...'; }

      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();

        if (res.ok && data.user && data.user.role === 'admin') {
          localStorage.setItem('lcu_findme_token', data.token);
          localStorage.setItem('lcu_findme_user', JSON.stringify(data.user));
          adminName = data.user.name || 'CSO Officer';
          localStorage.setItem('lcu_findme_admin_name', adminName);
          showToast(`Welcome, ${adminName}. Security Console Unlocked.`, 'success');
          unlockPortal();
        } else {
          if (errorMsg) {
            errorMsg.textContent = data.message || 'Unauthorized: Security Administrator credentials required.';
            errorMsg.style.display = 'block';
          }
        }
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = 'Network error connecting to security server. Ensure backend is running.';
          errorMsg.style.display = 'block';
        }
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Verify & Enter Console'; }
      }
    });
  }

  // Update Header Elements
  function updateAdminHeader() {
    const nameEl = document.getElementById('admin-header-username');
    const rankEl = document.getElementById('admin-header-rank');
    const avatarEl = document.getElementById('admin-header-avatar');
    const stationBadge = document.getElementById('admin-duty-station-badge');
    const officerStat = document.getElementById('log-stat-officer');

    if (nameEl) nameEl.textContent = adminName;
    if (rankEl) rankEl.textContent = adminRank;
    if (avatarEl) {
      const parts = adminName.trim().split(' ');
      avatarEl.textContent = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).charAt(0).toUpperCase();
    }
    if (stationBadge) stationBadge.textContent = adminOffice || 'Post A Active';
    if (officerStat) officerStat.textContent = adminOffice || 'Main Gate Desk';
  }

  // ============================================================
  // TAB ROUTING & NAVIGATION
  // ============================================================
  const tabs = {
    dashboard: { section: document.getElementById('section-dashboard'), nav: document.getElementById('nav-dashboard') },
    claims:    { section: document.getElementById('section-claims'),    nav: document.getElementById('nav-claims') },
    users:     { section: document.getElementById('section-users'),     nav: document.getElementById('nav-users') },
    log:       { section: document.getElementById('section-verif-log'), nav: document.getElementById('nav-verif-log') },
    alerts:    { section: document.getElementById('section-alerts'),    nav: document.getElementById('nav-alerts') }
  };

  function switchTab(tabKey) {
    currentTab = tabKey;
    Object.keys(tabs).forEach(key => {
      const item = tabs[key];
      if (!item) return;
      if (key === tabKey) {
        if (item.section) item.section.classList.remove('hidden');
        if (item.nav) item.nav.classList.add('active');
      } else {
        if (item.section) item.section.classList.add('hidden');
        if (item.nav) item.nav.classList.remove('active');
      }
    });

    if (tabKey === 'claims') renderClaimsInbox();
    if (tabKey === 'users') renderUserDirectory();
    if (tabKey === 'log') renderVerifLog();
    if (tabKey === 'alerts') renderAlertsList();
  }

  Object.keys(tabs).forEach(key => {
    const item = tabs[key];
    if (item && item.nav) {
      item.nav.addEventListener('click', e => {
        e.preventDefault();
        switchTab(key);
      });
    }
  });

  const jumpToClaimsBtn = document.getElementById('btn-view-pending-claims');
  if (jumpToClaimsBtn) {
    jumpToClaimsBtn.addEventListener('click', () => switchTab('claims'));
  }

  // ============================================================
  // DATA LOADING & POLLING
  // ============================================================
  async function loadAllData() {
    await Promise.allSettled([
      fetchItems(),
      fetchStats(),
      fetchClaims(),
      fetchUsers(),
      fetchVerifications(),
      fetchAlerts()
    ]);
  }

  async function fetchItems() {
    try {
      const res = await fetch(`${API_URL}/items`);
      if (res.ok) {
        adminItems = await res.json();
        renderDashboardItems();
      }
    } catch (err) {
      console.warn('Error loading items:', err);
    }
  }

  async function fetchStats() {
    try {
      const token = localStorage.getItem('lcu_findme_token');
      const res = await fetch(`${API_URL}/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.stats) updateKpiDeck(data.stats);
      }
    } catch (err) {
      // Fallback compute locally from adminItems
      computeLocalStats();
    }
  }

  function computeLocalStats() {
    const total = adminItems.length;
    const lost = adminItems.filter(i => i.type === 'lost' && i.status !== 'returned').length;
    const found = adminItems.filter(i => i.type === 'found' && i.status !== 'returned').length;
    const returned = adminItems.filter(i => i.status === 'returned').length;

    let pendingClaims = 0;
    adminItems.forEach(i => {
      (i.verificationClaims || []).forEach(c => {
        if (c.status === 'pending' || !c.status) pendingClaims++;
      });
    });

    const statTotal = document.getElementById('admin-stat-total');
    const statLost = document.getElementById('admin-stat-lost');
    const statFound = document.getElementById('admin-stat-found');
    const statReturned = document.getElementById('admin-stat-returned');
    const statClaims = document.getElementById('admin-stat-claims');

    if (statTotal) statTotal.textContent = total;
    if (statLost) statLost.textContent = lost;
    if (statFound) statFound.textContent = found;
    if (statReturned) statReturned.textContent = returned;
    if (statClaims) statClaims.textContent = pendingClaims;

    updatePendingClaimsBanner(pendingClaims);
  }

  function updateKpiDeck(stats) {
    const statTotal = document.getElementById('admin-stat-total');
    const statLost = document.getElementById('admin-stat-lost');
    const statFound = document.getElementById('admin-stat-found');
    const statReturned = document.getElementById('admin-stat-returned');
    const statUsers = document.getElementById('admin-stat-users');
    const statActivated = document.getElementById('admin-stat-activated-count');
    const statClaims = document.getElementById('admin-stat-claims');

    if (statTotal) statTotal.textContent = stats.totalItems ?? adminItems.length;
    if (statLost) statLost.textContent = stats.activeLost ?? 0;
    if (statFound) statFound.textContent = stats.activeFound ?? 0;
    if (statReturned) statReturned.textContent = stats.returnedItems ?? 0;
    if (statUsers) statUsers.textContent = stats.totalUsers ?? adminUsers.length;
    if (statActivated) statActivated.textContent = stats.activatedUsers ?? 0;
    if (statClaims) statClaims.textContent = stats.pendingClaims ?? 0;

    updatePendingClaimsBanner(stats.pendingClaims ?? 0);
  }

  function updatePendingClaimsBanner(pendingCount) {
    const banner = document.getElementById('admin-pending-claims-alert');
    const bannerText = document.getElementById('pending-claims-text');
    const navBadge = document.getElementById('claims-badge');

    if (navBadge) {
      navBadge.textContent = pendingCount;
      navBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    if (pendingCount > 0) {
      if (banner && bannerText) {
        bannerText.innerHTML = `You have <strong>${pendingCount}</strong> pending student ownership verification claim(s) awaiting review!`;
        banner.style.display = 'flex';
      }
    } else {
      if (banner) banner.style.display = 'none';
    }
  }

  async function fetchClaims() {
    try {
      const token = localStorage.getItem('lcu_findme_token');
      const res = await fetch(`${API_URL}/admin/claims`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        adminClaims = data.claims || [];
      } else {
        deriveClaimsFromItems();
      }
    } catch {
      deriveClaimsFromItems();
    }
    if (currentTab === 'claims') renderClaimsInbox();
  }

  function deriveClaimsFromItems() {
    const list = [];
    adminItems.forEach(item => {
      (item.verificationClaims || []).forEach(claim => {
        list.push({
          claimId: claim._id || claim.id,
          itemId: item._id || item.id,
          itemTitle: item.title,
          itemType: item.type,
          itemCategory: item.category,
          itemLocation: item.location,
          itemStatus: item.status,
          claimantName: claim.claimantName,
          claimantMatric: claim.claimantMatric,
          claimantEmail: claim.claimantEmail,
          claimantPhone: claim.claimantPhone,
          claimantFaculty: claim.claimantFaculty,
          claimantDept: claim.claimantDept,
          claimantLevel: claim.claimantLevel,
          claimDetails: claim.claimDetails,
          claimDate: claim.claimDate,
          status: claim.status || 'pending'
        });
      });
    });
    list.sort((a, b) => new Date(b.claimDate) - new Date(a.claimDate));
    adminClaims = list;
  }

  async function fetchUsers() {
    try {
      const token = localStorage.getItem('lcu_findme_token');
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        adminUsers = data.users || [];
        if (currentTab === 'users') renderUserDirectory();
      }
    } catch (err) {
      console.warn('Error fetching users directory:', err);
    }
  }

  async function fetchVerifications() {
    try {
      const token = localStorage.getItem('lcu_findme_token');
      const res = await fetch(`${API_URL}/admin/verifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        adminVerifLogs = data.logs || [];
        saveLocalVerifLog(adminVerifLogs);
      } else {
        adminVerifLogs = getLocalVerifLog();
      }
    } catch {
      adminVerifLogs = getLocalVerifLog();
    }
    renderVerifLog();
  }

  async function fetchAlerts() {
    try {
      const res = await fetch(`${API_URL}/admin/alerts`);
      if (res.ok) {
        const data = await res.json();
        adminAlerts = data.alerts || [];
        if (currentTab === 'alerts') renderAlertsList();
      }
    } catch (err) {
      console.warn('Error loading alerts:', err);
    }
  }

  // ============================================================
  // TAB 1: OVERVIEW & ITEMS TABLE RENDERING
  // ============================================================
  const searchInput = document.getElementById('admin-search-input');
  const filterType = document.getElementById('filter-item-type');
  const filterCat = document.getElementById('filter-item-category');
  const filterStatus = document.getElementById('filter-item-status');
  const filterSort = document.getElementById('filter-item-sort');

  [searchInput, filterType, filterCat, filterStatus, filterSort].forEach(el => {
    if (el) {
      el.addEventListener('input', renderDashboardItems);
      el.addEventListener('change', renderDashboardItems);
    }
  });

  function renderDashboardItems() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;

    const searchTerm = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const typeVal = filterType ? filterType.value : 'all';
    const catVal = filterCat ? filterCat.value : 'all';
    const statusVal = filterStatus ? filterStatus.value : 'all';
    const sortVal = filterSort ? filterSort.value : 'newest';

    let filtered = adminItems.filter(item => {
      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const reporter = (item.reporterName || '').toLowerCase();
      const matric = (item.reporterMatric || '').toLowerCase();
      const loc = (item.location || '').toLowerCase();
      const id = String(item._id || item.id || '').toLowerCase();

      const matchesSearch = !searchTerm ||
        title.includes(searchTerm) ||
        desc.includes(searchTerm) ||
        reporter.includes(searchTerm) ||
        matric.includes(searchTerm) ||
        loc.includes(searchTerm) ||
        id.includes(searchTerm);

      const matchesType = (typeVal === 'all') || (item.type === typeVal);
      const matchesCat = (catVal === 'all') || (item.category === catVal);

      let matchesStatus = true;
      if (statusVal === 'active') {
        matchesStatus = item.status !== 'returned';
      } else if (statusVal === 'returned') {
        matchesStatus = item.status === 'returned';
      } else if (statusVal === 'claims_pending') {
        matchesStatus = (item.verificationClaims || []).some(c => c.status === 'pending' || !c.status);
      }

      return matchesSearch && matchesType && matchesCat && matchesStatus;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortVal === 'newest') return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt);
      if (sortVal === 'oldest') return new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt);
      if (sortVal === 'title_asc') return (a.title || '').localeCompare(b.title || '');
      return 0;
    });

    computeLocalStats();

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:var(--text-muted);">No reports matching your criteria found.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    filtered.forEach(item => {
      const tr = document.createElement('tr');
      const itemId = item._id || item.id;
      const idShort = String(itemId).substring(0, 8);
      const isReturned = item.status === 'returned';
      const badgeClass = isReturned ? 'status-returned' : 'status-active';

      const pendingClaimsCount = (item.verificationClaims || []).filter(c => c.status === 'pending' || !c.status).length;
      const pendingBadge = pendingClaimsCount > 0
        ? `<span class="status-badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; font-size: 0.68rem; margin-left: 0.4rem; padding: 0.15rem 0.45rem; border-radius: 999px;">⚠️ ${pendingClaimsCount} Claim${pendingClaimsCount > 1 ? 's' : ''}</span>`
        : '';

      const typeBadge = item.type === 'found'
        ? `<span style="color:#2563eb; font-weight:700;">🛡️ Found</span>`
        : `<span style="color:#ef4444; font-weight:700;">🔍 Lost</span>`;

      tr.innerHTML = `
        <td data-label="ID" style="font-family:monospace;font-size:0.8rem;color:var(--text-muted);">${idShort}</td>
        <td data-label="Item Name" style="font-weight:600;color:var(--secondary);">${escapeHtml(item.title)}${pendingBadge}</td>
        <td data-label="Category" style="text-transform:capitalize;">${escapeHtml(item.category || 'Other')}</td>
        <td data-label="Type">${typeBadge}</td>
        <td data-label="Status"><span class="status-badge ${badgeClass}">${escapeHtml(item.status || 'active')}</span></td>
        <td data-label="Reporter">${escapeHtml(item.reporterName || 'Anonymous')}</td>
        <td data-label="Date Logged" style="font-size:0.85rem;color:var(--text-muted);">${formatDate(item.date || item.createdAt)}</td>
        <td data-label="Actions" class="action-cell" style="text-align:right;">
          <div style="display:inline-flex;gap:0.4rem;justify-content:flex-end;align-items:center;">
            <button class="btn btn-secondary btn-review" data-id="${itemId}" style="padding:0.25rem 0.65rem;font-size:0.75rem;">Review</button>
            <button class="btn btn-secondary btn-slip" data-id="${itemId}" style="padding:0.25rem 0.6rem;font-size:0.75rem;" title="View or Print Handover Slip">📄 Slip</button>
            <button class="btn btn-secondary btn-delete-row" data-id="${itemId}" style="padding:0.25rem 0.6rem;font-size:0.75rem;color:var(--danger);border-color:var(--danger);" title="Delete Record">✕</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Wire table row buttons
    tbody.querySelectorAll('.btn-review').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        openAdminDetail(b.getAttribute('data-id'));
      });
    });

    tbody.querySelectorAll('.btn-slip').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        openHandoverSlipForItem(b.getAttribute('data-id'));
      });
    });

    tbody.querySelectorAll('.btn-delete-row').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        deleteItem(b.getAttribute('data-id'));
      });
    });
  }

  // Export Items CSV
  const btnExportItemsCSV = document.getElementById('btn-export-items-csv');
  if (btnExportItemsCSV) {
    btnExportItemsCSV.addEventListener('click', () => {
      if (adminItems.length === 0) { showToast('No items available to export.', 'warning'); return; }
      const headers = ['Item ID', 'Title', 'Category', 'Type', 'Status', 'Location', 'Reporter Name', 'Reporter Contact', 'Reporter Matric', 'Date Logged', 'Claims Count'];
      const rows = adminItems.map(i => [
        i._id || i.id, i.title, i.category, i.type, i.status, i.location,
        i.reporterName, i.reporterContact, i.reporterMatric || 'N/A',
        formatDateTime(i.date || i.createdAt), (i.verificationClaims || []).length
      ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));

      const csv = [headers.join(','), ...rows].join('\n');
      downloadBlob(csv, `LCU_Campus_Items_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
    });
  }

  // ============================================================
  // TAB 2: CLAIMS & DISPUTES INBOX
  // ============================================================
  const filterClaimStatus = document.getElementById('filter-claims-status');
  if (filterClaimStatus) {
    filterClaimStatus.addEventListener('change', renderClaimsInbox);
  }

  function renderClaimsInbox() {
    const container = document.getElementById('claims-grid-container');
    if (!container) return;

    const filterVal = filterClaimStatus ? filterClaimStatus.value : 'pending';
    let filtered = adminClaims.filter(c => {
      if (filterVal === 'all') return true;
      return (c.status || 'pending') === filterVal;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:3.5rem 1rem; color:var(--text-muted); background:var(--card-bg); border-radius:var(--radius-md); border:1px dashed var(--border-color);">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">🎉</div>
          <h3 style="font-size:1.1rem; color:var(--secondary); margin-bottom:0.25rem;">No ${filterVal} claims in this category</h3>
          <p style="font-size:0.85rem; margin:0;">All student property verification claims are currently up to date.</p>
        </div>`;
      return;
    }

    container.innerHTML = '';
    filtered.forEach(claim => {
      const card = document.createElement('div');
      const st = claim.status || 'pending';
      card.className = `claim-inbox-card ${st}`;

      const statusBadge = st === 'accepted'
        ? `<span class="badge-active-status activated">✓ Verified &amp; Released</span>`
        : st === 'declined'
        ? `<span class="badge-active-status" style="background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.25);">✗ Declined</span>`
        : `<span class="badge-active-status unactivated">⏳ Pending Officer Review</span>`;

      card.innerHTML = `
        <div class="claim-header-row">
          <div>
            <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700; letter-spacing:0.5px;">Claim for Item:</span>
            <h3 style="font-size:1.05rem; margin:0.2rem 0; color:var(--secondary);">${escapeHtml(claim.itemTitle)}</h3>
            <span style="font-family:monospace; font-size:0.75rem; color:var(--text-muted);">Item ID: ${String(claim.itemId).substring(0, 10)}...</span>
          </div>
          <div>${statusBadge}</div>
        </div>

        <div class="claim-meta-box">
          <div><strong>Claimant:</strong> ${escapeHtml(claim.claimantName)} (${escapeHtml(claim.claimantMatric)})</div>
          <div><strong>Contact:</strong> ${escapeHtml(claim.claimantPhone || 'N/A')} | ${escapeHtml(claim.claimantEmail || 'N/A')}</div>
          ${claim.claimantFaculty ? `<div><strong>Faculty / Dept:</strong> ${escapeHtml(claim.claimantFaculty)} — ${escapeHtml(claim.claimantDept || '')}</div>` : ''}
          <div><strong>Claimed At:</strong> ${formatDateTime(claim.claimDate)}</div>
        </div>

        <div>
          <strong style="font-size:0.78rem; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Student Proof / Verification Note:</strong>
          <p style="font-size:0.85rem; margin:0.25rem 0 0 0; background:var(--bg-tertiary); padding:0.65rem; border-radius:var(--radius-sm);">${escapeHtml(claim.claimDetails)}</p>
        </div>

        <div style="margin-top:auto; padding-top:0.75rem; border-top:1px solid var(--border-color); display:flex; gap:0.5rem; justify-content:flex-end;">
          ${st === 'pending' ? `
            <button class="btn btn-primary btn-claim-accept" data-item-id="${claim.itemId}" data-claim-id="${claim.claimId}" style="padding:0.4rem 0.75rem; font-size:0.8rem; background:var(--success); border-color:var(--success);">
              ✓ Accept &amp; Release
            </button>
            <button class="btn btn-secondary btn-claim-decline" data-item-id="${claim.itemId}" data-claim-id="${claim.claimId}" style="padding:0.4rem 0.75rem; font-size:0.8rem; color:var(--danger); border-color:var(--danger);">
              Decline
            </button>
          ` : `
            <button class="btn btn-secondary btn-claim-view-slip" data-item-id="${claim.itemId}" style="padding:0.4rem 0.75rem; font-size:0.8rem;">
              📄 View Handover Slip
            </button>
          `}
          <button class="btn btn-secondary btn-claim-view-item" data-item-id="${claim.itemId}" style="padding:0.4rem 0.75rem; font-size:0.8rem;">
            Inspect Item
          </button>
        </div>
      `;
      container.appendChild(card);
    });

    // Wire buttons
    container.querySelectorAll('.btn-claim-accept').forEach(b => {
      b.addEventListener('click', async () => {
        const itemId = b.getAttribute('data-item-id');
        const claimId = b.getAttribute('data-claim-id');
        await respondToClaim(itemId, claimId, 'accept');
      });
    });

    container.querySelectorAll('.btn-claim-decline').forEach(b => {
      b.addEventListener('click', async () => {
        const itemId = b.getAttribute('data-item-id');
        const claimId = b.getAttribute('data-claim-id');
        await respondToClaim(itemId, claimId, 'decline');
      });
    });

    container.querySelectorAll('.btn-claim-view-slip').forEach(b => {
      b.addEventListener('click', () => {
        openHandoverSlipForItem(b.getAttribute('data-item-id'));
      });
    });

    container.querySelectorAll('.btn-claim-view-item').forEach(b => {
      b.addEventListener('click', () => {
        openAdminDetail(b.getAttribute('data-item-id'));
      });
    });
  }

  async function respondToClaim(itemId, claimId, action) {
    if (!confirm(`Are you sure you want to ${action.toUpperCase()} this student ownership claim?`)) return;
    try {
      const token = localStorage.getItem('lcu_findme_token');
      const res = await fetch(`${API_URL}/items/${itemId}/claims/${claimId}/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      if (res.ok) {
        showToast(`Claim successfully ${action}ed!`, 'success');
        const targetItem = adminItems.find(i => (i._id || i.id) === itemId);
        const targetClaim = (targetItem?.verificationClaims || []).find(c => (c._id || c.id) === claimId);

        if (action === 'accept') {
          // Record permanent chain of custody
          await recordVerificationLogEntry({
            itemId,
            itemTitle: targetItem ? targetItem.title : 'Campus Property',
            claimantName: targetClaim ? targetClaim.claimantName : 'Verified Student',
            claimantId: targetClaim ? targetClaim.claimantMatric : 'N/A',
            claimantEmail: targetClaim ? targetClaim.claimantEmail : '',
            claimantPhone: targetClaim ? targetClaim.claimantPhone : '',
            officerName: adminName,
            station: adminOffice,
            notes: `Claim accepted & custody transferred at ${adminOffice}. Proof: ${targetClaim?.claimDetails || 'Verified in person'}.`
          });

          // Open Handover Slip for immediate printing
          openHandoverSlipForItem(itemId, targetClaim);
        }

        await loadAllData();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Failed to update claim response.', 'error');
      }
    } catch (err) {
      showToast('Network error processing claim response.', 'error');
    }
  }

  // ============================================================
  // TAB 3: USER & STUDENT DIRECTORY MANAGEMENT
  // ============================================================
  const userSearchInput = document.getElementById('admin-user-search');
  const userRoleFilter = document.getElementById('filter-user-role');
  const userActivationFilter = document.getElementById('filter-user-activation');
  const userVerificationFilter = document.getElementById('filter-user-verification');

  [userSearchInput, userRoleFilter, userActivationFilter, userVerificationFilter].forEach(el => {
    if (el) {
      el.addEventListener('input', renderUserDirectory);
      el.addEventListener('change', renderUserDirectory);
    }
  });

  function renderUserDirectory() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    const searchTerm = (userSearchInput ? userSearchInput.value : '').trim().toLowerCase();
    const roleVal = userRoleFilter ? userRoleFilter.value : 'all';
    const actVal = userActivationFilter ? userActivationFilter.value : 'all';
    const verifVal = userVerificationFilter ? userVerificationFilter.value : 'all';

    let filtered = adminUsers.filter(user => {
      const name = (user.name || '').toLowerCase();
      const matric = (user.matricNumber || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const dept = (user.department || '').toLowerCase();
      const faculty = (user.faculty || '').toLowerCase();

      const matchesSearch = !searchTerm ||
        name.includes(searchTerm) ||
        matric.includes(searchTerm) ||
        email.includes(searchTerm) ||
        dept.includes(searchTerm) ||
        faculty.includes(searchTerm);

      const matchesRole = (roleVal === 'all') || (user.role === roleVal);
      const matchesAct = (actVal === 'all') || (String(Boolean(user.isActivated)) === actVal);
      const matchesVerif = (verifVal === 'all') || (String(Boolean(user.isVerified)) === verifVal);

      return matchesSearch && matchesRole && matchesAct && matchesVerif;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2.5rem;color:var(--text-muted);">No accounts matching directory search criteria found.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    filtered.forEach(user => {
      const tr = document.createElement('tr');
      const userId = user._id || user.id;
      const initial = (user.name || 'U').charAt(0).toUpperCase();

      const roleBadge = user.role === 'admin'
        ? `<span class="badge-role-admin">🛡️ Security Admin</span>`
        : user.role === 'staff'
        ? `<span class="badge-role-staff">Staff Member</span>`
        : `<span class="badge-role-student">Student</span>`;

      const activationBadge = user.isActivated
        ? `<span class="badge-active-status activated">● Activated</span>`
        : `<span class="badge-active-status unactivated">⏳ Pending Activation</span>`;

      const emailVerifIcon = user.isVerified
        ? `<span title="Email verified" style="color:var(--success); font-size:0.75rem;">✓ Verified</span>`
        : `<span title="Email unverified" style="color:var(--text-muted); font-size:0.75rem;">Unverified</span>`;

      tr.innerHTML = `
        <td data-label="User / Student">
          <div style="display:flex;align-items:center;gap:0.6rem;">
            <div class="user-avatar-badge">${initial}</div>
            <div>
              <div style="font-weight:700;color:var(--secondary);font-size:0.9rem;">${escapeHtml(user.name)}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">${emailVerifIcon}</div>
            </div>
          </div>
        </td>
        <td data-label="Matric / Staff ID" style="font-family:monospace;font-size:0.85rem;font-weight:600;">${escapeHtml(user.matricNumber || 'N/A')}</td>
        <td data-label="Contact Info" style="font-size:0.82rem;">
          <div>${escapeHtml(user.email || 'No email')}</div>
          <div style="color:var(--text-muted);">${escapeHtml(user.phoneNumber || 'No phone')}</div>
        </td>
        <td data-label="Faculty & Department" style="font-size:0.82rem;">
          <div>${escapeHtml(user.department || 'N/A')}</div>
          <div style="color:var(--text-muted);">${escapeHtml(user.faculty || 'N/A')} • ${escapeHtml(user.level || 'N/A')}</div>
        </td>
        <td data-label="Role">${roleBadge}</td>
        <td data-label="Activation Status">${activationBadge}</td>
        <td data-label="Account Actions" class="action-cell" style="text-align:right;">
          <div style="display:inline-flex;gap:0.4rem;justify-content:flex-end;">
            <button class="btn btn-secondary btn-toggle-act" data-id="${userId}" data-status="${user.isActivated}" style="padding:0.25rem 0.55rem;font-size:0.75rem;${user.isActivated ? 'color:var(--warning);border-color:var(--warning);' : 'color:var(--success);border-color:var(--success);'}" title="Toggle activation override">
              ${user.isActivated ? 'Deactivate' : 'Manual Activate'}
            </button>
            <button class="btn btn-secondary btn-user-del" data-id="${userId}" style="padding:0.25rem 0.5rem;font-size:0.75rem;color:var(--danger);border-color:var(--danger);" title="Delete account">✕</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Wire buttons
    tbody.querySelectorAll('.btn-toggle-act').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        const curStatus = b.getAttribute('data-status') === 'true';
        await toggleUserActivation(id, !curStatus);
      });
    });

    tbody.querySelectorAll('.btn-user-del').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        await deleteUserAccount(id);
      });
    });
  }

  async function toggleUserActivation(userId, newStatus) {
    const actionText = newStatus ? 'ACTIVATING' : 'DEACTIVATING';
    if (!confirm(`Are you sure you want to ${actionText} this user's account access?`)) return;

    try {
      const token = localStorage.getItem('lcu_findme_token');
      const res = await fetch(`${API_URL}/admin/users/${userId}/activation`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActivated: newStatus, reason: 'Admin Manual Desk Action' })
      });

      if (res.ok) {
        showToast(`User account ${newStatus ? 'activated' : 'deactivated'} successfully!`, 'success');
        await fetchUsers();
        await fetchStats();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Failed to update user activation.', 'error');
      }
    } catch (err) {
      showToast('Network error updating user activation.', 'error');
    }
  }

  async function deleteUserAccount(userId) {
    if (!confirm('Are you sure you want to permanently delete this user account? All associated reports will remain intact.')) return;
    try {
      const token = localStorage.getItem('lcu_findme_token');
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('User account removed permanently.', 'success');
        await fetchUsers();
        await fetchStats();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Failed to delete user.', 'error');
      }
    } catch (err) {
      showToast('Network error deleting user.', 'error');
    }
  }

  // Export Users CSV
  const btnExportUsersCSV = document.getElementById('btn-export-users-csv');
  if (btnExportUsersCSV) {
    btnExportUsersCSV.addEventListener('click', () => {
      if (adminUsers.length === 0) { showToast('No users available to export.', 'warning'); return; }
      const headers = ['User ID', 'Full Name', 'Matric / Staff ID', 'Email', 'Phone', 'Faculty', 'Department', 'Level', 'Role', 'Activated', 'Verified', 'Created At'];
      const rows = adminUsers.map(u => [
        u._id || u.id, u.name, u.matricNumber, u.email || 'N/A', u.phoneNumber || 'N/A',
        u.faculty || 'N/A', u.department || 'N/A', u.level || 'N/A', u.role,
        u.isActivated ? 'Yes' : 'No', u.isVerified ? 'Yes' : 'No',
        formatDateTime(u.createdAt)
      ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));

      const csv = [headers.join(','), ...rows].join('\n');
      downloadBlob(csv, `LCU_Users_Directory_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
    });
  }

  // ============================================================
  // TAB 4: CHAIN OF CUSTODY (VERIFICATION LEDGER)
  // ============================================================
  async function recordVerificationLogEntry(entry) {
    try {
      const token = localStorage.getItem('lcu_findme_token');
      const res = await fetch(`${API_URL}/admin/verifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(entry)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.log) adminVerifLogs.unshift(data.log);
      } else {
        adminVerifLogs.unshift({ ...entry, timestamp: new Date().toISOString() });
      }
    } catch {
      adminVerifLogs.unshift({ ...entry, timestamp: new Date().toISOString() });
    }
    saveLocalVerifLog(adminVerifLogs);
    renderVerifLog();
  }

  function renderVerifLog() {
    const tbody = document.getElementById('verif-log-tbody');
    if (!tbody) return;

    const log = adminVerifLogs;
    const totalEl = document.getElementById('log-stat-total');
    const todayEl = document.getElementById('log-stat-today');
    const badge = document.getElementById('verif-log-badge');

    if (totalEl) totalEl.textContent = log.length;
    if (todayEl) {
      const todayStr = new Date().toDateString();
      todayEl.textContent = log.filter(e => new Date(e.timestamp).toDateString() === todayStr).length;
    }
    if (badge) {
      badge.textContent = log.length;
      badge.style.display = log.length > 0 ? 'inline-flex' : 'none';
    }

    if (log.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="verif-log-empty" style="text-align:center;padding:2.5rem;color:var(--text-muted);">
            <span style="font-size:2rem;display:block;margin-bottom:0.5rem;">🔒</span>
            No physical handovers recorded yet. Accept a claim or approve a return to create the first custody entry.
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    log.forEach((entry, idx) => {
      const tr = document.createElement('tr');
      if (idx === 0) tr.classList.add('log-row-new');
      const dt = new Date(entry.timestamp);
      const fDate = dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      const fTime = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const idShort = String(entry.itemId).substring(0, 10) + '...';

      tr.innerHTML = `
        <td data-label="Timestamp" class="log-timestamp" style="font-size:0.82rem;">${fDate}<br><span style="color:var(--text-muted);">${fTime}</span></td>
        <td data-label="Item Name" style="font-weight:700;color:var(--secondary);">${escapeHtml(entry.itemTitle)}</td>
        <td data-label="Item ID" style="font-family:monospace;font-size:0.8rem;color:var(--text-muted);">${idShort}</td>
        <td data-label="Claimant Name" style="font-weight:600;">${escapeHtml(entry.claimantName)}</td>
        <td data-label="Matric / Staff ID" style="font-family:monospace;font-size:0.85rem;">${escapeHtml(entry.claimantId)}</td>
        <td data-label="Officer"><span class="log-officer">👮 ${escapeHtml(entry.officerName || 'CSO Officer')}</span></td>
        <td data-label="Station" style="font-size:0.82rem;color:var(--text-muted);">${escapeHtml(entry.station || 'Security Desk')}</td>
        <td data-label="Slip" style="text-align:right;">
          <button class="btn btn-secondary btn-log-slip" data-index="${idx}" style="padding:0.25rem 0.6rem;font-size:0.75rem;">📄 Slip</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-log-slip').forEach(b => {
      b.addEventListener('click', () => {
        const idx = Number(b.getAttribute('data-index'));
        const entry = log[idx];
        if (entry) openHandoverSlipFromLog(entry);
      });
    });
  }

  // Export Custody CSV
  const btnExportCSV = document.getElementById('btn-export-csv');
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
      const log = adminVerifLogs;
      if (log.length === 0) { showToast('No verification log entries to export.', 'warning'); return; }
      const headers = ['Timestamp', 'Item Name', 'Item ID', 'Claimant Name', 'Matric / Staff ID', 'Officer Name', 'Duty Station', 'Notes'];
      const rows = log.map(e => [
        formatDateTime(e.timestamp), e.itemTitle, e.itemId,
        e.claimantName, e.claimantId, e.officerName || 'CSO Officer',
        e.station || 'Security Post', e.notes || ''
      ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));

      const csv = [headers.join(','), ...rows].join('\n');
      downloadBlob(csv, `LCU_Chain_Of_Custody_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
    });
  }

  // ============================================================
  // TAB 5: CAMPUS SECURITY BROADCAST ALERTS
  // ============================================================
  function renderAlertsList() {
    const container = document.getElementById('alerts-list-container');
    if (!container) return;

    if (adminAlerts.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted); background:var(--card-bg); border-radius:var(--radius-md); border:1px dashed var(--border-color);">
          <div style="font-size:2.2rem; margin-bottom:0.5rem;">📢</div>
          <h3 style="font-size:1.05rem; color:var(--secondary); margin-bottom:0.25rem;">No Active Security Broadcasts</h3>
          <p style="font-size:0.85rem; margin:0;">Click "New Broadcast" to announce high-priority lost/found notices to students.</p>
        </div>`;
      return;
    }

    container.innerHTML = '';
    adminAlerts.forEach(alert => {
      const card = document.createElement('div');
      const pri = alert.priority || 'info';
      card.className = `alert-item-card ${pri}`;

      const priBadge = pri === 'urgent'
        ? `<span style="color:#ef4444; font-weight:800; text-transform:uppercase; font-size:0.75rem;">🚨 URGENT</span>`
        : pri === 'warning'
        ? `<span style="color:#f59e0b; font-weight:800; text-transform:uppercase; font-size:0.75rem;">⚠️ IMPORTANT</span>`
        : `<span style="color:#2563eb; font-weight:800; text-transform:uppercase; font-size:0.75rem;">ℹ️ NOTICE</span>`;

      card.innerHTML = `
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.35rem;">
            ${priBadge}
            <span style="font-size:0.75rem;color:var(--text-muted);">${formatDateTime(alert.createdAt)}</span>
          </div>
          <h3 style="font-size:1.05rem;margin:0 0 0.25rem 0;color:var(--secondary);">${escapeHtml(alert.title)}</h3>
          <p style="font-size:0.88rem;margin:0;color:var(--text-dark);">${escapeHtml(alert.message)}</p>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.4rem;">Posted by: <strong>${escapeHtml(alert.postedBy || 'Security Command')}</strong></div>
        </div>
        <div>
          <button class="btn btn-secondary btn-del-alert" data-id="${alert._id || alert.id}" style="color:var(--danger);border-color:var(--danger);padding:0.4rem 0.75rem;font-size:0.8rem;">
            Delete Notice
          </button>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-del-alert').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        await deleteAlert(id);
      });
    });
  }

  const btnCreateAlertTrigger = document.getElementById('btn-create-alert-trigger');
  const btnHeroPostAlert = document.getElementById('btn-hero-post-alert');
  [btnCreateAlertTrigger, btnHeroPostAlert].forEach(b => {
    if (b) b.addEventListener('click', () => toggleModal('modal-create-alert', true));
  });

  const btnCloseCreateAlert = document.getElementById('btn-close-create-alert');
  if (btnCloseCreateAlert) btnCloseCreateAlert.addEventListener('click', () => toggleModal('modal-create-alert', false));

  const formCreateAlert = document.getElementById('form-create-alert');
  if (formCreateAlert) {
    formCreateAlert.addEventListener('submit', async e => {
      e.preventDefault();
      const title = document.getElementById('alert-title').value.trim();
      const priority = document.getElementById('alert-priority').value;
      const message = document.getElementById('alert-message').value.trim();

      try {
        const token = localStorage.getItem('lcu_findme_token');
        const res = await fetch(`${API_URL}/admin/alerts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title, priority, message })
        });

        if (res.ok) {
          showToast('Campus security alert broadcasted successfully!', 'success');
          formCreateAlert.reset();
          toggleModal('modal-create-alert', false);
          await fetchAlerts();
          switchTab('alerts');
        } else {
          showToast('Failed to post alert.', 'error');
        }
      } catch (err) {
        showToast('Network error posting alert.', 'error');
      }
    });
  }

  async function deleteAlert(id) {
    if (!confirm('Are you sure you want to delete this security announcement?')) return;
    try {
      const token = localStorage.getItem('lcu_findme_token');
      const res = await fetch(`${API_URL}/admin/alerts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Announcement removed.', 'info');
        await fetchAlerts();
      }
    } catch {
      showToast('Network error removing alert.', 'error');
    }
  }

  // ============================================================
  // SECURITY PROPERTY INTAKE MODAL
  // ============================================================
  const btnHeaderIntake = document.getElementById('btn-header-intake');
  const btnHeroIntake = document.getElementById('btn-hero-intake');
  const btnCloseIntake = document.getElementById('btn-close-intake');

  [btnHeaderIntake, btnHeroIntake].forEach(b => {
    if (b) b.addEventListener('click', () => toggleModal('modal-security-intake', true));
  });

  if (btnCloseIntake) btnCloseIntake.addEventListener('click', () => toggleModal('modal-security-intake', false));

  const formIntake = document.getElementById('form-security-intake');
  if (formIntake) {
    formIntake.addEventListener('submit', async e => {
      e.preventDefault();
      const title = document.getElementById('intake-title').value.trim();
      const category = document.getElementById('intake-category').value;
      const binTag = document.getElementById('intake-bin').value.trim();
      const location = document.getElementById('intake-location').value.trim();
      const finderName = document.getElementById('intake-finder-name').value.trim();
      const finderContact = document.getElementById('intake-finder-contact').value.trim();
      const description = document.getElementById('intake-description').value.trim();

      const submitBtn = formIntake.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Recording Property Intake...'; }

      try {
        const token = localStorage.getItem('lcu_findme_token');
        const res = await fetch(`${API_URL}/admin/intake`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title, category, location, binTag,
            finderName, finderContact, description
          })
        });

        if (res.ok) {
          const data = await res.json();
          showToast(`Property "${title}" securely logged into ${binTag}!`, 'success');
          formIntake.reset();
          toggleModal('modal-security-intake', false);
          await loadAllData();

          if (data.item) {
            openHandoverSlipForItem(data.item._id || data.item.id);
          }
        } else {
          const err = await res.json().catch(() => ({}));
          showToast(err.message || 'Intake failed. Please retry.', 'error');
        }
      } catch (err) {
        showToast('Network error during security intake.', 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Confirm Custody & Log Intake'; }
      }
    });
  }

  // ============================================================
  // OFFICIAL PRINTABLE HANDOVER RELEASE SLIP
  // ============================================================
  const btnCloseSlip = document.getElementById('btn-close-slip');
  const btnCloseSlip2 = document.getElementById('btn-close-slip-2');
  const btnPrintSlip = document.getElementById('btn-print-slip');

  [btnCloseSlip, btnCloseSlip2].forEach(b => {
    if (b) b.addEventListener('click', () => toggleModal('modal-handover-slip', false));
  });

  if (btnPrintSlip) {
    btnPrintSlip.addEventListener('click', () => {
      window.print();
    });
  }

  function openHandoverSlipForItem(itemId, explicitClaim = null) {
    const item = adminItems.find(i => (i._id || i.id) === itemId);
    if (!item) { showToast('Item details not found.', 'error'); return; }

    const claim = explicitClaim || (item.verificationClaims || []).find(c => c.status === 'accepted') || (item.verificationClaims || [])[0];

    const ref = `LCU-SEC-${String(itemId).substring(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const dateStr = formatDateTime(new Date());

    document.getElementById('slip-cert-ref').textContent = ref;
    document.getElementById('slip-cert-date').textContent = dateStr;
    document.getElementById('slip-cert-officer').textContent = `${adminName} (${adminRank})`;
    document.getElementById('slip-cert-station').textContent = adminOffice;

    document.getElementById('slip-item-title').textContent = item.title;
    document.getElementById('slip-item-id').textContent = `Item ID: ${itemId} • Type: ${item.type.toUpperCase()}`;
    document.getElementById('slip-item-desc').textContent = item.description || 'No additional description.';

    document.getElementById('slip-claimant-name').textContent = claim ? claim.claimantName : (item.reporterName || 'Verified Recipient');
    document.getElementById('slip-claimant-matric').textContent = claim ? (claim.claimantMatric || 'N/A') : (item.reporterMatric || 'N/A');
    document.getElementById('slip-claimant-contact').textContent = claim
      ? `Email: ${claim.claimantEmail || 'N/A'} | Phone: ${claim.claimantPhone || 'N/A'}`
      : `Contact: ${item.reporterContact || 'In-person'}`;

    toggleModal('modal-handover-slip', true);
  }

  function openHandoverSlipFromLog(entry) {
    const ref = `LCU-CUSTODY-${String(entry.itemId).substring(0, 6).toUpperCase()}`;
    document.getElementById('slip-cert-ref').textContent = ref;
    document.getElementById('slip-cert-date').textContent = formatDateTime(entry.timestamp);
    document.getElementById('slip-cert-officer').textContent = `${entry.officerName || adminName}`;
    document.getElementById('slip-cert-station').textContent = entry.station || adminOffice;

    document.getElementById('slip-item-title').textContent = entry.itemTitle;
    document.getElementById('slip-item-id').textContent = `Item ID: ${entry.itemId}`;
    document.getElementById('slip-item-desc').textContent = entry.notes || 'Verified institutional custody transfer.';

    document.getElementById('slip-claimant-name').textContent = entry.claimantName;
    document.getElementById('slip-claimant-matric').textContent = entry.claimantId;
    document.getElementById('slip-claimant-contact').textContent = `Email: ${entry.claimantEmail || 'N/A'} | Phone: ${entry.claimantPhone || 'N/A'}`;

    toggleModal('modal-handover-slip', true);
  }

  // ============================================================
  // ITEM REVIEW & VERIFICATION MODAL
  // ============================================================
  function openAdminDetail(id) {
    const item = adminItems.find(i => (i._id || i.id) === id);
    if (!item) { showToast('Item not found.', 'error'); return; }

    const body = document.getElementById('admin-detail-body');
    if (!body) return;
    const itemId = item._id || item.id;

    let claimsHtml = '';
    if (item.verificationClaims && item.verificationClaims.length > 0) {
      claimsHtml = `
        <div style="margin-top:1rem;border-top:1px dashed var(--border-color);padding-top:1rem;">
          <h4 style="font-size:0.9rem;color:var(--text-dark);margin-bottom:0.5rem;">🚨 Submitted Ownership Claims:</h4>
          ${item.verificationClaims.map(c => `
            <div style="background:var(--bg-tertiary);padding:0.75rem;border-radius:var(--radius-sm);margin-bottom:0.5rem;font-size:0.82rem;border-left: 3px solid ${c.status === 'accepted' ? 'var(--success)' : c.status === 'declined' ? 'var(--danger)' : 'var(--warning)'};">
              <div><strong>Claimant:</strong> ${escapeHtml(c.claimantName)} (${escapeHtml(c.claimantMatric)})</div>
              <div><strong>Contact:</strong> ${escapeHtml(c.claimantPhone || 'N/A')} • ${escapeHtml(c.claimantEmail || 'N/A')}</div>
              <div><strong>Verification Detail:</strong> ${escapeHtml(c.claimDetails)}</div>
              <div style="margin-top:0.25rem;"><strong>Status:</strong> <span style="text-transform:uppercase;font-weight:bold;color:${c.status === 'accepted' ? 'var(--success)' : c.status === 'declined' ? 'var(--danger)' : 'var(--warning)'};">${escapeHtml(c.status || 'pending')}</span></div>
              ${(c.status === 'pending' || !c.status) && item.status !== 'returned' ? `
                <div style="margin-top:0.5rem;display:flex;gap:0.5rem;">
                  <button class="btn btn-primary btn-modal-claim-accept" data-claim-id="${c._id || c.id}" style="padding:0.25rem 0.6rem;font-size:0.75rem;background:var(--success);border-color:var(--success);">Accept Claim</button>
                  <button class="btn btn-secondary btn-modal-claim-decline" data-claim-id="${c._id || c.id}" style="padding:0.25rem 0.6rem;font-size:0.75rem;color:var(--danger);border-color:var(--danger);">Decline</button>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>`;
    }

    let actionHtml = '';
    if (item.status !== 'returned') {
      actionHtml = `
        <div style="margin-top:1.5rem;padding-top:1.25rem;border-top:1px solid var(--border-color);">
          <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem;text-align:center;">
            🔒 Verify claimant identification and physical possession before release.
          </div>
          <div style="display:flex;gap:0.75rem;">
            <button class="btn btn-primary" id="btn-admin-verify" style="flex:1;justify-content:center;">✓ Authorize Return</button>
            <button class="btn btn-secondary" id="btn-admin-open-slip" style="padding:0.6rem 1rem;">📄 Slip</button>
            <button class="btn btn-secondary" id="btn-admin-delete" style="color:var(--danger);border-color:var(--danger);padding:0.6rem 0.85rem;">✕ Delete</button>
          </div>
        </div>`;
    } else {
      actionHtml = `
        <div style="margin-top:1.5rem;padding:0.85rem;background:var(--success-bg);color:var(--success);border-radius:var(--radius-md);font-weight:700;text-align:center;margin-bottom:1rem;">
          ✅ Property Returned &amp; Custody Terminated
        </div>
        <div style="display:flex;gap:0.75rem;">
          <button class="btn btn-secondary" id="btn-admin-open-slip" style="flex:1;justify-content:center;">📄 Print Release Slip</button>
          <button class="btn btn-secondary" id="btn-admin-delete" style="color:var(--danger);border-color:var(--danger);padding:0.6rem 1rem;">✕ Delete</button>
        </div>`;
    }

    body.innerHTML = `
      <div style="display:flex;gap:1.25rem;flex-direction:column;">
        <div>
          <h2 style="font-size:1.3rem;margin:0 0 0.25rem 0;color:var(--secondary);">${escapeHtml(item.title)}</h2>
          <div style="font-family:monospace;font-size:0.82rem;color:var(--text-muted);">Item ID: ${itemId} | Type: ${item.type.toUpperCase()} | Status: ${item.status.toUpperCase()}</div>
        </div>

        <div style="background:var(--bg-secondary);padding:1rem;border-radius:var(--radius-md);display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;font-size:0.85rem;">
          <div><strong>Category:</strong> ${escapeHtml(item.category)}</div>
          <div><strong>Location:</strong> ${escapeHtml(item.location)}</div>
          <div><strong>Reporter:</strong> ${escapeHtml(item.reporterName)}</div>
          <div><strong>Contact:</strong> ${escapeHtml(item.reporterContact)}</div>
          <div><strong>Matric / Staff:</strong> ${escapeHtml(item.reporterMatric || 'N/A')}</div>
          <div><strong>Date:</strong> ${formatDate(item.date || item.createdAt)}</div>
        </div>

        <div>
          <h4 style="margin:0 0 0.35rem 0;font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Description</h4>
          <p style="font-size:0.9rem;margin:0;line-height:1.4;">${escapeHtml(item.description)}</p>
        </div>

        ${claimsHtml}
        ${actionHtml}
      </div>`;

    toggleModal('modal-admin-detail', true);

    // Wire buttons in modal
    body.querySelectorAll('.btn-modal-claim-accept').forEach(b => {
      b.addEventListener('click', async () => {
        const claimId = b.getAttribute('data-claim-id');
        await respondToClaim(itemId, claimId, 'accept');
        toggleModal('modal-admin-detail', false);
      });
    });

    body.querySelectorAll('.btn-modal-claim-decline').forEach(b => {
      b.addEventListener('click', async () => {
        const claimId = b.getAttribute('data-claim-id');
        await respondToClaim(itemId, claimId, 'decline');
        toggleModal('modal-admin-detail', false);
      });
    });

    const btnVerify = document.getElementById('btn-admin-verify');
    if (btnVerify) {
      btnVerify.addEventListener('click', async () => {
        btnVerify.disabled = true;
        btnVerify.textContent = 'Processing...';
        try {
          const token = localStorage.getItem('lcu_findme_token');
          const res = await fetch(`${API_URL}/items/${itemId}/resolve`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            showToast('Item marked as successfully returned!', 'success');
            await recordVerificationLogEntry({
              itemId,
              itemTitle: item.title,
              claimantName: item.reporterName || 'Verified Claimant',
              claimantId: item.reporterMatric || 'In-Person',
              claimantEmail: item.reporterEmail || '',
              claimantPhone: item.reporterContact || '',
              officerName: adminName,
              station: adminOffice,
              notes: 'Authorized return by duty officer.'
            });
            toggleModal('modal-admin-detail', false);
            await loadAllData();
            openHandoverSlipForItem(itemId);
          } else {
            showToast('Failed to resolve item.', 'error');
            btnVerify.disabled = false;
            btnVerify.textContent = '✓ Authorize Return';
          }
        } catch {
          showToast('Network error authorizing return.', 'error');
          btnVerify.disabled = false;
        }
      });
    }

    const btnOpenSlip = document.getElementById('btn-admin-open-slip');
    if (btnOpenSlip) {
      btnOpenSlip.addEventListener('click', () => {
        toggleModal('modal-admin-detail', false);
        openHandoverSlipForItem(itemId);
      });
    }

    const btnDelete = document.getElementById('btn-admin-delete');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => deleteItem(itemId, true));
    }
  }

  const btnCloseAdminDetail = document.getElementById('btn-close-admin-detail');
  if (btnCloseAdminDetail) {
    btnCloseAdminDetail.addEventListener('click', () => toggleModal('modal-admin-detail', false));
  }

  async function deleteItem(id, closeModal = false) {
    if (!confirm('Are you sure you want to permanently delete this item record?')) return;
    try {
      const token = localStorage.getItem('lcu_findme_token');
      const res = await fetch(`${API_URL}/items/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Record deleted permanently.', 'info');
        if (closeModal) toggleModal('modal-admin-detail', false);
        await loadAllData();
      } else {
        showToast('Failed to delete item.', 'error');
      }
    } catch {
      showToast('Network error deleting item.', 'error');
    }
  }

  // ============================================================
  // QR SCANNER
  // ============================================================
  const navScanner = document.getElementById('nav-scanner');
  const btnHeaderScanner = document.getElementById('btn-header-scanner');

  [navScanner, btnHeaderScanner].forEach(b => {
    if (b) {
      b.addEventListener('click', e => {
        e.preventDefault();
        resetScannerUI();
        toggleModal('modal-scanner', true);
      });
    }
  });

  const btnCloseScanner = document.getElementById('btn-close-scanner');
  if (btnCloseScanner) {
    btnCloseScanner.addEventListener('click', async () => {
      await stopScanner();
      toggleModal('modal-scanner', false);
    });
  }

  function resetScannerUI() {
    const readerEl = document.getElementById('reader');
    const startBtn = document.getElementById('btn-start-scan');
    const statusText = document.getElementById('scan-status-text');

    if (readerEl) {
      readerEl.innerHTML = `
        <div style="padding:3rem 0;text-align:center;font-size:3rem;opacity:0.2;">📷</div>
        <div class="scan-laser" id="scan-laser-line" style="display:none;"></div>`;
    }
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = '▶ Start Camera Scan';
    }
    if (statusText) statusText.textContent = 'Point camera at a QR code on an item tag.';
  }

  async function stopScanner() {
    if (html5Scanner && scannerRunning) {
      try { await html5Scanner.stop(); } catch (e) {}
      try { await html5Scanner.clear(); } catch (e) {}
    }
    html5Scanner = null;
    scannerRunning = false;
    resetScannerUI();
  }

  async function handleScanResult(decodedText) {
    stopScanner();
    toggleModal('modal-scanner', false);

    let itemId = decodedText.trim();
    if (decodedText.includes('item=')) {
      try {
        const urlObj = new URL(decodedText, window.location.origin);
        itemId = urlObj.searchParams.get('item') || itemId;
      } catch {
        const m = decodedText.match(/[?&]item=([^&]+)/);
        if (m) itemId = m[1];
      }
    }

    const exists = adminItems.find(i =>
      (i._id || i.id) === itemId ||
      (i._id || i.id).endsWith(itemId) ||
      (i._id || i.id).replace('item-', '') === itemId
    );

    if (exists) {
      showToast(`Item "${exists.title}" identified!`, 'success');
      openAdminDetail(exists._id || exists.id);
    } else {
      showToast(`Item ID "${itemId}" not found. Try Manual Entry.`, 'warning');
    }
  }

  const btnStartScan = document.getElementById('btn-start-scan');
  if (btnStartScan) {
    btnStartScan.addEventListener('click', async () => {
      const statusText = document.getElementById('scan-status-text');
      if (typeof Html5Qrcode === 'undefined') {
        showToast('QR Scanner library not available.', 'error');
        return;
      }

      btnStartScan.disabled = true;
      btnStartScan.textContent = 'Starting camera...';
      if (statusText) statusText.textContent = 'Requesting camera access...';

      if (html5Scanner && scannerRunning) await stopScanner();
      html5Scanner = new Html5Qrcode('reader');

      try {
        await html5Scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          decodedText => handleScanResult(decodedText),
          () => {}
        );
        scannerRunning = true;
        const laser = document.getElementById('scan-laser-line');
        if (laser) laser.style.display = 'block';

        btnStartScan.textContent = '⏹ Stop Scan';
        btnStartScan.disabled = false;
        btnStartScan.onclick = async () => {
          await stopScanner();
          btnStartScan.onclick = null;
        };
        if (statusText) statusText.textContent = 'Scanning... point at QR code label.';
      } catch (err) {
        showToast('Camera access denied or unavailable.', 'error');
        btnStartScan.disabled = false;
        btnStartScan.textContent = '▶ Retry Camera Scan';
      }
    });
  }

  const btnManualScan = document.getElementById('btn-manual-scan');
  if (btnManualScan) {
    btnManualScan.addEventListener('click', () => {
      const input = document.getElementById('manual-scan-input');
      const inputId = input ? input.value.trim() : '';
      if (!inputId) return;

      stopScanner();
      const exists = adminItems.find(i =>
        (i._id || i.id) === inputId ||
        (i._id || i.id).endsWith(inputId) ||
        (i._id || i.id).replace('item-', '') === inputId
      );

      if (exists) {
        toggleModal('modal-scanner', false);
        if (input) input.value = '';
        openAdminDetail(exists._id || exists.id);
      } else {
        showToast(`Item "${inputId}" not found in database.`, 'error');
      }
    });
  }

  // ============================================================
  // EDIT ADMIN PROFILE & DUTY STATION
  // ============================================================
  const btnOfficerTrigger = document.getElementById('btn-officer-profile-trigger');
  if (btnOfficerTrigger) {
    btnOfficerTrigger.addEventListener('click', () => {
      const nameInput = document.getElementById('edit-admin-name');
      const rankInput = document.getElementById('edit-admin-rank');
      const emailInput = document.getElementById('edit-admin-email');
      const officeInput = document.getElementById('edit-admin-office');

      if (nameInput) nameInput.value = adminName;
      if (rankInput) rankInput.value = adminRank;
      if (emailInput) emailInput.value = localStorage.getItem('lcu_findme_admin_email') || 'security@lcu.edu.ng';
      if (officeInput) officeInput.value = adminOffice;

      const preview = document.getElementById('admin-edit-avatar-preview');
      if (preview) preview.textContent = adminName.charAt(0).toUpperCase();
      toggleModal('modal-edit-admin-profile', true);
    });
  }

  const btnCloseEditAdminProfile = document.getElementById('btn-close-edit-admin-profile');
  if (btnCloseEditAdminProfile) {
    btnCloseEditAdminProfile.addEventListener('click', () => toggleModal('modal-edit-admin-profile', false));
  }

  const formEditAdminProfile = document.getElementById('form-edit-admin-profile');
  if (formEditAdminProfile) {
    formEditAdminProfile.addEventListener('submit', e => {
      e.preventDefault();
      const newName = document.getElementById('edit-admin-name').value.trim();
      const newRank = document.getElementById('edit-admin-rank').value.trim();
      const newEmail = document.getElementById('edit-admin-email').value.trim();
      const newOffice = document.getElementById('edit-admin-office').value.trim();

      if (newName) {
        adminName = newName;
        adminRank = newRank || 'Duty Officer';
        adminOffice = newOffice || 'Gate A Main Desk';

        localStorage.setItem('lcu_findme_admin_name', adminName);
        localStorage.setItem('lcu_findme_admin_rank', adminRank);
        localStorage.setItem('lcu_findme_admin_email', newEmail);
        localStorage.setItem('lcu_findme_admin_office', adminOffice);

        updateAdminHeader();
        toggleModal('modal-edit-admin-profile', false);
        showToast('Officer profile & duty station updated!', 'success');
      }
    });
  }

  // ============================================================
  // HAMBURGER MENU (MOBILE)
  // ============================================================
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const mainNav = document.getElementById('main-nav');
  if (hamburgerBtn && mainNav) {
    hamburgerBtn.addEventListener('click', e => {
      e.stopPropagation();
      mainNav.classList.toggle('open');
      hamburgerBtn.classList.toggle('open');
    });
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        hamburgerBtn.classList.remove('open');
      });
    });
    document.addEventListener('click', e => {
      if (!mainNav.contains(e.target) && e.target !== hamburgerBtn) {
        mainNav.classList.remove('open');
        hamburgerBtn.classList.remove('open');
      }
    });
  }

  // Helper: Download Blob as File
  function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // LIVE POLLING (EVERY 6 SECONDS)
  // ============================================================
  setInterval(async () => {
    if (overlay && overlay.style.display === 'none') {
      try {
        await Promise.allSettled([fetchItems(), fetchStats()]);
      } catch (e) {}
    }
  }, 6000);

  // Initial check
  checkAuthStatus();
});
