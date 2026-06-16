// ============================================================
// LCU FINDME — ADMIN PORTAL JS
// ============================================================

const API_URL = window.location.hostname === '127.0.0.1' ||
  window.location.hostname === 'localhost' ||
  window.location.protocol === 'file:'
  ? 'http://127.0.0.1:5000/api'
  : 'https://leadcitylostnfound.onrender.com/api';

// ============================================================
// VERIFICATION LOG — DATA FUNCTIONS (must be global for DOMContentLoaded access)
// ============================================================
const VERIF_LOG_KEY = 'lcu_findme_verif_log';

function getVerifLog() {
  try { return JSON.parse(localStorage.getItem(VERIF_LOG_KEY) || '[]'); }
  catch { return []; }
}

function appendVerifLog(entry) {
  const log = getVerifLog();
  log.unshift(entry);
  localStorage.setItem(VERIF_LOG_KEY, JSON.stringify(log));
  renderVerifLog();
}

function renderVerifLog() {
  const log = getVerifLog();
  const tbody = document.getElementById('verif-log-tbody');
  if (!tbody) return;

  updateLogStats(log);

  const badge = document.getElementById('verif-log-badge');
  if (badge) {
    badge.textContent = log.length;
    badge.style.display = log.length > 0 ? 'inline-flex' : 'none';
  }

  if (log.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="verif-log-empty">
          <span class="verif-empty-icon">📚</span>
          No handovers recorded yet. Approve an item return to create the first log entry.
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
      <td data-label="Timestamp" class="log-timestamp">${fDate}<br>${fTime}</td>
      <td data-label="Item Name" style="font-weight:600;color:var(--secondary);">${escapeHtml(entry.itemTitle)}</td>
      <td data-label="Item ID" style="font-family:monospace;font-size:0.8rem;color:var(--text-muted);">${idShort}</td>
      <td data-label="Claimant">${escapeHtml(entry.claimantName)}</td>
      <td data-label="Claimant ID" style="font-family:monospace;font-size:0.85rem;">${escapeHtml(entry.claimantId)}</td>
      <td data-label="Officer"><span class="log-officer">👮 ${escapeHtml(entry.officerName)}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateLogStats(log) {
  const totalEl   = document.getElementById('log-stat-total');
  const todayEl   = document.getElementById('log-stat-today');
  const officerEl = document.getElementById('log-stat-officer');
  if (totalEl) totalEl.textContent = log.length;
  if (todayEl) {
    const todayStr = new Date().toDateString();
    todayEl.textContent = log.filter(e => new Date(e.timestamp).toDateString() === todayStr).length;
  }
  if (officerEl) officerEl.textContent = localStorage.getItem('lcu_findme_admin_name') || 'CSO Olabisi';
}

function exportVerifLogCSV() {
  const log = getVerifLog();
  if (log.length === 0) { alert('No verification log entries to export.'); return; }
  const headers = ['Timestamp', 'Item Name', 'Item ID', 'Claimant Name', 'Matric / Staff ID', 'Officer Name'];
  const rows = log.map(e => [
    new Date(e.timestamp).toLocaleString(), e.itemTitle, e.itemId,
    e.claimantName, e.claimantId, e.officerName
  ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LCU_Verification_Log_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown Date';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ============================================================
// MAIN DOM READY
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

  let adminItems = [];
  let adminName  = localStorage.getItem('lcu_findme_admin_name') || 'CSO Olabisi';
  let html5Scanner = null;  // holds the active Html5Qrcode instance
  let scannerRunning = false;

  // ---- THEME ----
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

  // ---- MODAL UTIL ----
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

  // Attach backdrop-click close + container stop-prop to every modal
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) {
        // If scanner modal, also stop scanner
        if (backdrop.id === 'modal-scanner') stopScanner();
        toggleModal(backdrop.id, false);
      }
    });
    const container = backdrop.querySelector('.modal-container');
    if (container) container.addEventListener('click', e => e.stopPropagation());
  });

  // ---- ADMIN AUTH OVERLAY ----
  const overlay       = document.getElementById('admin-login-overlay');
  const appContainer  = document.querySelector('.app-container');
  const storedUser    = JSON.parse(localStorage.getItem('lcu_findme_user') || 'null');

  function unlockPortal() {
    if (overlay)       overlay.style.display = 'none';
    if (appContainer)  appContainer.style.opacity = '1';
    updateAdminHeader();
    loadData();
    renderVerifLog();
  }

  if (storedUser && storedUser.role === 'admin') {
    unlockPortal();
  } else {
    if (overlay)      overlay.style.display = 'flex';
    if (appContainer) appContainer.style.opacity = '0.08';
  }

  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const identifier = document.getElementById('admin-login-email').value.trim();
      const password   = document.getElementById('admin-login-password').value;
      const errorMsg   = document.getElementById('admin-login-error');
      if (errorMsg) errorMsg.style.display = 'none';

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Verifying...'; }

      try {
        const res  = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();

        if (res.ok && data.user && data.user.role === 'admin') {
          localStorage.setItem('lcu_findme_token', data.token);
          localStorage.setItem('lcu_findme_user', JSON.stringify(data.user));
          adminName = data.user.name;
          localStorage.setItem('lcu_findme_admin_name', adminName);
          unlockPortal();
        } else {
          if (errorMsg) {
            errorMsg.textContent = data.message || 'Unauthorized: Admin credentials required.';
            errorMsg.style.display = 'block';
          }
        }
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = 'Connection error. Please check your network.';
          errorMsg.style.display = 'block';
        }
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Verify & Access Console'; }
      }
    });
  }

  // ---- ADMIN HEADER ----
  function updateAdminHeader() {
    const nameEl   = document.getElementById('admin-header-username');
    const avatarEl = document.getElementById('admin-header-avatar');
    if (nameEl)   nameEl.textContent = adminName;
    if (avatarEl) {
      const parts = adminName.trim().split(' ');
      avatarEl.textContent = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).charAt(0).toUpperCase();
    }
  }

  // ---- LOAD DATA ----
  async function loadData() {
    try {
      const res  = await fetch(`${API_URL}/items`);
      if (!res.ok) throw new Error('Failed to fetch items');
      adminItems = await res.json();
      renderDashboard();
    } catch (err) {
      console.error('Error loading admin items:', err);
    }
  }

  // ---- RENDER DASHBOARD ----
  function renderDashboard() {
    const total    = adminItems.length;
    const lost     = adminItems.filter(i => i.type === 'lost' && i.status !== 'returned').length;
    const returned = adminItems.filter(i => i.status === 'returned').length;

    const statTotal    = document.getElementById('admin-stat-total');
    const statLost     = document.getElementById('admin-stat-lost');
    const statReturned = document.getElementById('admin-stat-returned');
    if (statTotal)    statTotal.textContent    = total;
    if (statLost)     statLost.textContent     = lost;
    if (statReturned) statReturned.textContent = returned;

    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sorted = [...adminItems].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sorted.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;">No reports found in the system.</td></tr>`;
      return;
    }

    sorted.forEach(item => {
      const tr = document.createElement('tr');
      const badgeClass = item.status === 'returned' ? 'status-returned' : 'status-active';
      const itemId = item._id || item.id;

      tr.innerHTML = `
        <td data-label="ID" style="font-family:monospace;font-size:0.8rem;color:var(--text-muted);">${itemId.substring(0, 8)}</td>
        <td data-label="Item Name" style="font-weight:600;color:var(--secondary);">${item.title}</td>
        <td data-label="Category" style="text-transform:capitalize;">${item.category}</td>
        <td data-label="Type">${item.type === 'found' ? 'Found' : 'Lost'}</td>
        <td data-label="Status"><span class="status-badge ${badgeClass}">${item.status}</span></td>
        <td data-label="Reporter">${item.reporterName}</td>
        <td data-label="Actions" class="action-cell" style="display:flex;gap:0.5rem;justify-content:flex-end;align-items:center;">
          <button class="btn btn-secondary btn-review" data-id="${itemId}" style="padding:0.25rem 0.6rem;font-size:0.75rem;">Review</button>
          <button class="btn btn-secondary btn-delete-row" data-id="${itemId}" style="padding:0.25rem 0.6rem;font-size:0.75rem;color:var(--danger);border-color:var(--danger);">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Review buttons
    tbody.querySelectorAll('.btn-review').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openAdminDetail(e.currentTarget.getAttribute('data-id'));
      });
    });

    // Delete buttons (table row)
    tbody.querySelectorAll('.btn-delete-row').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        await deleteItem(id);
      });
    });

    // Sync verif log badge
    renderVerifLog();
  }

  // ---- DELETE ITEM ----
  async function deleteItem(id, closeModal = false) {
    if (!confirm('Are you sure you want to permanently delete this record?')) return;
    try {
      const token = localStorage.getItem('lcu_findme_token');
      const res = await fetch(`${API_URL}/items/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        if (closeModal) toggleModal('modal-admin-detail', false);
        await loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to delete. Ensure you are authorised as admin.');
      }
    } catch (err) {
      alert('Network error. Please check your connection.');
    }
  }

  // ---- ADMIN DETAIL MODAL ----
  function openAdminDetail(id) {
    const item = adminItems.find(i => (i._id || i.id) === id);
    if (!item) { alert('Item not found.'); return; }

    const body = document.getElementById('admin-detail-body');
    if (!body) return;

    const itemId = item._id || item.id;

    let claimsHtml = '';
    if (item.verificationClaims && item.verificationClaims.length > 0) {
      claimsHtml = `
        <div style="margin-top:1rem;border-top:1px dashed var(--border-color);padding-top:1rem;">
          <h4 style="font-size:0.9rem;color:var(--text-dark);margin-bottom:0.5rem;">🚨 In-Person Claim Visit Notices:</h4>
          ${item.verificationClaims.map(c => `
            <div style="background:var(--bg-tertiary);padding:0.75rem;border-radius:var(--radius-sm);margin-bottom:0.5rem;font-size:0.82rem;border-left: 3px solid ${c.status === 'accepted' ? 'var(--success)' : c.status === 'declined' ? 'var(--danger)' : 'var(--warning)'};">
              <div><strong>Claimant Name:</strong> ${escapeHtml(c.claimantName)}</div>
              <div><strong>Matric No:</strong> ${escapeHtml(c.claimantMatric)}</div>
              <div><strong>Verification Note:</strong> ${escapeHtml(c.claimDetails)}</div>
              <div><strong>Status:</strong> <span style="text-transform:uppercase; font-weight:bold; color:${c.status === 'accepted' ? 'var(--success)' : c.status === 'declined' ? 'var(--danger)' : 'var(--warning)'};">${escapeHtml(c.status || 'pending')}</span></div>
              
              ${(c.status === 'pending' || !c.status) && item.status !== 'returned' ? `
                <div style="margin-top:0.5rem; display:flex; gap:0.5rem;">
                  <button class="btn btn-primary btn-claim-respond" data-claim-id="${c._id}" data-action="accept" style="padding:0.25rem 0.5rem; font-size:0.75rem; background:var(--success); border-color:var(--success); color:white; cursor:pointer;">Accept Claim</button>
                  <button class="btn btn-secondary btn-claim-respond" data-claim-id="${c._id}" data-action="decline" style="padding:0.25rem 0.5rem; font-size:0.75rem; color:var(--danger); border-color:var(--danger); background:none; cursor:pointer;">Decline Claim</button>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>`;
    }

    let actionHtml = '';
    if (item.status !== 'returned') {
      actionHtml = `
        <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border-color);">
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.75rem;font-style:italic;text-align:center;">
            🔒 <strong>Verification Desk:</strong> Verify claimant's ID & ownership in person before approving.
          </div>
          <div style="display:flex;gap:1rem;">
            <button class="btn btn-primary" id="btn-admin-verify" style="flex:1;justify-content:center;">Approve & Mark Returned</button>
            <button class="btn btn-secondary" id="btn-admin-delete" style="flex:1;justify-content:center;color:var(--danger);border-color:var(--danger);">Delete Record</button>
          </div>
        </div>`;
    } else {
      actionHtml = `
        <div style="margin-top:1.5rem;padding:1rem;background:var(--success-bg);color:var(--success);border-radius:var(--radius-md);font-weight:600;text-align:center;margin-bottom:1rem;">
          ✅ This item has been successfully resolved and returned.
        </div>
        <div style="display:flex;gap:1rem;">
          <button class="btn btn-secondary" id="btn-admin-delete" style="flex:1;justify-content:center;color:var(--danger);border-color:var(--danger);">Delete Record</button>
        </div>`;
    }

    body.innerHTML = `
      <div style="display:flex;gap:1.5rem;flex-direction:column;">
        <div>
          <h2 style="font-size:1.25rem;margin-bottom:0.25rem;color:var(--secondary);">${escapeHtml(item.title)}</h2>
          <div style="font-family:monospace;font-size:0.85rem;color:var(--text-muted);">ID: ${itemId} | Type: ${item.type.toUpperCase()}</div>
        </div>
        <div style="background:var(--bg-secondary);padding:1rem;border-radius:var(--radius-md);">
          <div style="margin-bottom:0.5rem;"><strong>Reporter:</strong> ${escapeHtml(item.reporterName)}</div>
          <div style="margin-bottom:0.5rem;"><strong>Contact:</strong> ${escapeHtml(item.reporterContact)}</div>
          <div style="margin-bottom:0.5rem;"><strong>Location:</strong> ${escapeHtml(item.location)}</div>
          <div><strong>Date:</strong> ${formatDate(item.date)}</div>
        </div>
        <div>
          <h4 style="margin-bottom:0.5rem;font-size:0.9rem;color:var(--text-muted);text-transform:uppercase;">Description</h4>
          <p style="font-size:0.95rem;">${escapeHtml(item.description)}</p>
        </div>
        ${claimsHtml}
        ${actionHtml}
      </div>`;

    toggleModal('modal-admin-detail', true);

    // Wire claim response buttons
    body.querySelectorAll('.btn-claim-respond').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const claimId = e.currentTarget.getAttribute('data-claim-id');
        const action = e.currentTarget.getAttribute('data-action');
        btn.disabled = true;
        btn.textContent = 'Processing...';

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
            const updatedData = await res.json();
            // Re-fetch data and reload view
            await loadData();
            
            // Add entry to verification log if accepted
            if (action === 'accept') {
              const claim = item.verificationClaims.find(c => c._id === claimId);
              appendVerifLog({
                itemTitle:    item.title,
                itemId:       itemId,
                claimantName: claim ? claim.claimantName : 'Walk-in Claimant',
                claimantId:   claim ? claim.claimantMatric : 'N/A',
                officerName:  adminName,
                timestamp:    new Date().toISOString()
              });
            }

            openAdminDetail(itemId); // refresh details view in modal
          } else {
            const data = await res.json().catch(() => ({}));
            alert(data.message || 'Failed to process response.');
            btn.disabled = false;
            btn.textContent = action === 'accept' ? 'Accept Claim' : 'Decline Claim';
          }
        } catch (err) {
          alert('Network error. Please try again.');
          btn.disabled = false;
          btn.textContent = action === 'accept' ? 'Accept Claim' : 'Decline Claim';
        }
      });
    });

    // Wire verify button
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
            const claimant = item.verificationClaims && item.verificationClaims.length > 0
              ? item.verificationClaims[item.verificationClaims.length - 1]
              : null;
            appendVerifLog({
              itemTitle:    item.title,
              itemId:       itemId,
              claimantName: claimant ? claimant.claimantName : 'Walk-in Claimant',
              claimantId:   claim ? claimant.claimantMatric : 'N/A',
              officerName:  adminName,
              timestamp:    new Date().toISOString()
            });
            toggleModal('modal-admin-detail', false);
            await loadData();
          } else {
            const data = await res.json().catch(() => ({}));
            alert(data.message || 'Failed to approve. Ensure you are authorised.');
            btnVerify.disabled = false;
            btnVerify.textContent = 'Approve & Mark Returned';
          }
        } catch (err) {
          alert('Network error. Please check your connection.');
          btnVerify.disabled = false;
          btnVerify.textContent = 'Approve & Mark Returned';
        }
      });
    }

    // Wire delete button inside detail modal
    const btnDelete = document.getElementById('btn-admin-delete');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => deleteItem(itemId, true));
    }
  }

  // Wire close button for admin detail modal
  const btnCloseAdminDetail = document.getElementById('btn-close-admin-detail');
  if (btnCloseAdminDetail) {
    btnCloseAdminDetail.addEventListener('click', () => toggleModal('modal-admin-detail', false));
  }

  // ============================================================
  // QR SCANNER SECTION
  // ============================================================

  // Reset scanner UI to idle state
  function resetScannerUI() {
    const readerEl   = document.getElementById('reader');
    const startBtn   = document.getElementById('btn-start-scan');
    const statusText = document.getElementById('scan-status-text');

    if (readerEl) {
      readerEl.innerHTML = `
        <div style="padding:3rem 0;text-align:center;font-size:3rem;opacity:0.2;">📷</div>`;
    }
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = '▶ Start Camera Scan';
    }
    if (statusText) statusText.textContent = 'Point camera at a QR code on an item tag.';
  }

  // Stop scanner gracefully
  async function stopScanner() {
    if (html5Scanner && scannerRunning) {
      try {
        await html5Scanner.stop();
      } catch (e) { /* ignore */ }
      try {
        await html5Scanner.clear();
      } catch (e) { /* ignore */ }
    }
    html5Scanner   = null;
    scannerRunning = false;
    resetScannerUI();
  }

  // Handle a decoded QR result
  async function handleScanResult(decodedText) {
    stopScanner();
    toggleModal('modal-scanner', false);

    let itemId = decodedText.trim();
    if (decodedText.includes('item=')) {
      try {
        let urlObj;
        if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
          urlObj = new URL(decodedText);
        } else {
          urlObj = new URL(decodedText, window.location.origin);
        }
        itemId = urlObj.searchParams.get('item') || itemId;
      } catch {
        const m = decodedText.match(/[?&]item=([^&]+)/);
        if (m) itemId = m[1];
      }
    }

    await loadData();

    const exists = adminItems.find(i =>
      (i._id || i.id) === itemId ||
      (i._id || i.id).endsWith(itemId)
    );

    if (exists) {
      openAdminDetail(exists._id || exists.id);
    } else {
      alert(`Item ID "${itemId}" not found in the database.\nTry the Manual Entry field.`);
    }
  }

  // Open scanner modal
  const navScanner = document.getElementById('nav-scanner');
  if (navScanner) {
    navScanner.addEventListener('click', e => {
      e.preventDefault();
      resetScannerUI();
      toggleModal('modal-scanner', true);
    });
  }

  // Start Scan button — only starts camera when clicked
  const btnStartScan = document.getElementById('btn-start-scan');
  if (btnStartScan) {
    btnStartScan.addEventListener('click', async () => {
      const statusText = document.getElementById('scan-status-text');

      if (typeof Html5Qrcode === 'undefined') {
        const readerEl = document.getElementById('reader');
        if (readerEl) readerEl.innerHTML = `
          <div style="padding:2rem 1rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">⚠️</div>
            QR scanner library failed to load. Use Manual Entry below.
          </div>`;
        return;
      }

      btnStartScan.disabled = true;
      btnStartScan.textContent = 'Starting camera...';
      if (statusText) statusText.textContent = 'Requesting camera access...';

      // Stop any previous scanner
      if (html5Scanner && scannerRunning) await stopScanner();

      html5Scanner = new Html5Qrcode('reader');
      const config = { fps: 10, qrbox: { width: 220, height: 220 } };

      try {
        await html5Scanner.start(
          { facingMode: 'environment' },
          config,
          decodedText => handleScanResult(decodedText),
          () => {} // silent frame errors
        );
        scannerRunning = true;
        btnStartScan.textContent = '⏹ Stop Scan';
        btnStartScan.disabled = false;
        // Toggle behaviour: second click stops
        btnStartScan.onclick = async () => {
          await stopScanner();
          btnStartScan.onclick = null; // restore original click
        };
        if (statusText) statusText.textContent = 'Scanning… point at QR code tag.';
      } catch (err) {
        console.error('Scanner start error:', err);
        const readerEl = document.getElementById('reader');
        if (readerEl) readerEl.innerHTML = `
          <div style="padding:2rem 1rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">📷</div>
            <strong>Camera access denied or unavailable.</strong><br>
            Please grant camera permission in your browser, or use Manual Entry below.
          </div>`;
        btnStartScan.disabled = false;
        btnStartScan.textContent = '▶ Retry Camera Scan';
        if (statusText) statusText.textContent = 'Camera unavailable. Try manual entry.';
      }
    });
  }

  // Close scanner X button
  const btnCloseScanner = document.getElementById('btn-close-scanner');
  if (btnCloseScanner) {
    btnCloseScanner.addEventListener('click', async () => {
      await stopScanner();
      toggleModal('modal-scanner', false);
    });
  }

  // Manual Scan lookup
  const btnManualScan = document.getElementById('btn-manual-scan');
  if (btnManualScan) {
    btnManualScan.addEventListener('click', async () => {
      const input = document.getElementById('manual-scan-input');
      const inputId = input ? input.value.trim() : '';
      if (!inputId) return;

      await stopScanner();

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
        alert('Item ID not found in database.');
      }
    });
  }

  // ---- EDIT ADMIN PROFILE ----
  const btnEditAdminProfile = document.getElementById('btn-edit-admin-profile');
  if (btnEditAdminProfile) {
    btnEditAdminProfile.addEventListener('click', () => {
      const nameInput = document.getElementById('edit-admin-name');
      if (nameInput) nameInput.value = adminName;
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
      if (newName) {
        adminName = newName;
        localStorage.setItem('lcu_findme_admin_name', adminName);
        updateAdminHeader();
        toggleModal('modal-edit-admin-profile', false);
      }
    });
  }

  // ---- NAVIGATION TABS ----
  const navDashboard = document.getElementById('nav-dashboard');
  const navVerifLog  = document.getElementById('nav-verif-log');
  const sectionDash  = document.getElementById('section-dashboard');
  const sectionLog   = document.getElementById('section-verif-log');

  function showSection(which) {
    if (which === 'dashboard') {
      if (sectionDash) sectionDash.classList.remove('hidden');
      if (sectionLog)  sectionLog.classList.remove('active');
      if (navDashboard) navDashboard.classList.add('active');
      if (navVerifLog)  navVerifLog.classList.remove('active');
    } else {
      if (sectionDash) sectionDash.classList.add('hidden');
      if (sectionLog)  sectionLog.classList.add('active');
      if (navDashboard) navDashboard.classList.remove('active');
      if (navVerifLog)  navVerifLog.classList.add('active');
      renderVerifLog();
    }
  }

  if (navDashboard) navDashboard.addEventListener('click', e => { e.preventDefault(); showSection('dashboard'); });
  if (navVerifLog)  navVerifLog.addEventListener('click',  e => { e.preventDefault(); showSection('log'); });

  // ---- EXPORT CSV ----
  const btnExportCSV = document.getElementById('btn-export-csv');
  if (btnExportCSV) btnExportCSV.addEventListener('click', exportVerifLogCSV);

  // ---- HAMBURGER ----
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const mainNav      = document.getElementById('main-nav');
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

  // ---- INITIAL RENDER ----
  updateAdminHeader();
  renderVerifLog();
});
