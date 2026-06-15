document.addEventListener('DOMContentLoaded', () => {
  // Client-side admin verification overlay logic
  const overlay = document.getElementById('admin-login-overlay');
  const appContainer = document.querySelector('.app-container');
  const user = JSON.parse(localStorage.getItem('lcu_findme_user') || 'null');

  if (user && user.role === 'admin') {
    if (overlay) overlay.style.display = 'none';
    if (appContainer) appContainer.style.opacity = '1';
    loadData();
  } else {
    if (overlay) overlay.style.display = 'flex';
    if (appContainer) appContainer.style.opacity = '0.08';
  }

  // Handle Admin Login submission
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('admin-login-email').value.trim();
      const password = document.getElementById('admin-login-password').value;
      const errorMsg = document.getElementById('admin-login-error');

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
          localStorage.setItem('lcu_findme_admin_name', data.user.name);
          
          if (overlay) overlay.style.display = 'none';
          if (appContainer) appContainer.style.opacity = '1';
          updateAdminHeader();
          loadData();
        } else {
          if (errorMsg) {
            errorMsg.textContent = data.message || 'Unauthorized: Admin credentials required.';
            errorMsg.style.display = 'block';
          }
        }
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = 'Connection error connecting to backend.';
          errorMsg.style.display = 'block';
        }
      }
    });
  }

  let adminItems = [];

  function initTheme() {
    const currentTheme = localStorage.getItem('lcu_findme_theme') || 'light';
    if (currentTheme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  // Theme Toggle Event Listener
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      const newTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
      localStorage.setItem('lcu_findme_theme', newTheme);
    });
  }

  const API_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:'
    ? 'http://127.0.0.1:5000/api'
    : 'https://leadcitylostnfound.onrender.com/api';

  async function loadData() {
    try {
      const res = await fetch(`${API_URL}/items`);
      const data = await res.json();
      adminItems = data;
      renderDashboard();
    } catch (err) {
      console.error('Error loading admin items:', err);
    }
  }

  function renderDashboard() {
    // 1. Update stats
    const total = adminItems.length;
    const lost = adminItems.filter(i => i.type === 'lost' && i.status !== 'returned').length;
    const returned = adminItems.filter(i => i.status === 'returned').length;

    document.getElementById('admin-stat-total').textContent = total;
    document.getElementById('admin-stat-lost').textContent = lost;
    document.getElementById('admin-stat-returned').textContent = returned;

    // 2. Render Table
    const tbody = document.getElementById('admin-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    // Sort items newest first
    const sorted = [...adminItems].sort((a,b) => new Date(b.date) - new Date(a.date));

    if (sorted.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No reports found in the system.</td></tr>`;
      return;
    }

    sorted.forEach(item => {
      const tr = document.createElement('tr');
      const badgeClass = item.status === 'returned' ? 'status-returned' : 'status-active';
      const typeText = item.type === 'found' ? 'Found' : 'Lost';
      const itemIdStr = (item._id || item.id).substring(0, 8);
      
      tr.innerHTML = `
        <td data-label="ID" style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${itemIdStr}</td>
        <td data-label="Item Name" style="font-weight: 600; color: var(--secondary);">${item.title}</td>
        <td data-label="Category" style="text-transform: capitalize;">${item.category}</td>
        <td data-label="Type">${typeText}</td>
        <td data-label="Status"><span class="status-badge ${badgeClass}">${item.status}</span></td>
        <td data-label="Reporter">${item.reporterName}</td>
        <td data-label="Actions">
          <button class="btn btn-secondary btn-review" data-id="${item._id || item.id}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">Review</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Attach review listeners
    document.querySelectorAll('.btn-review').forEach(btn => {
      btn.addEventListener('click', (e) => {
        openAdminDetail(e.target.getAttribute('data-id'));
      });
    });

    // Update verification log badge count
    const log = getVerifLog();
    const badge = document.getElementById('verif-log-badge');
    if (badge) {
      if (log.length > 0) {
        badge.textContent = log.length;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  // Modals
  function toggleModal(modalId, show) {
    const m = document.getElementById(modalId);
    if(m) {
      if(show) m.classList.add('active');
      else m.classList.remove('active');
    }
  }

  // Detail Modal Logic
  function openAdminDetail(id) {
    const item = adminItems.find(i => (i._id || i.id) === id);
    if (!item) return;

    const body = document.getElementById('admin-detail-body');
    
    let actionHtml = '';
    if (item.status !== 'returned') {
      actionHtml = `
        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem; font-style: italic; text-align: center;">
            🔒 <strong>Verification Desk:</strong> Verify Claimant's ID & ownership details in person before approving.
          </div>
          <div style="display: flex; gap: 1rem;">
            <button class="btn btn-primary" id="btn-admin-verify" style="flex: 1; justify-content: center;">Approve & Mark Returned</button>
            <button class="btn btn-secondary" id="btn-admin-delete" style="flex: 1; justify-content: center; color: var(--danger); border-color: var(--danger);">Delete Record</button>
          </div>
        </div>
      `;
    } else {
      actionHtml = `
        <div style="margin-top: 1.5rem; padding: 1rem; background-color: var(--success-bg); color: var(--success); border-radius: var(--radius-md); font-weight: 600; text-align: center;">
          This item has been successfully resolved and returned.
        </div>
      `;
    }

    // List claims if any exist
    let claimsHtml = '';
    if (item.verificationClaims && item.verificationClaims.length > 0) {
      claimsHtml = `
        <div style="margin-top: 1rem; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
          <h4 style="font-size: 0.9rem; color: var(--text-dark); margin-bottom: 0.5rem;">🚨 In-Person Claim Visit Notices:</h4>
          ${item.verificationClaims.map(c => `
            <div style="background-color: var(--bg-tertiary); padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 0.5rem; font-size: 0.82rem;">
              <div><strong>Claimant Name:</strong> ${c.claimantName}</div>
              <div><strong>Matric No:</strong> ${c.claimantMatric}</div>
              <div><strong>Verification Note:</strong> ${c.claimDetails}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    body.innerHTML = `
      <div style="display: flex; gap: 1.5rem; flex-direction: column;">
        <div>
          <h2 style="font-size: 1.25rem; margin-bottom: 0.25rem; color: var(--secondary);">${item.title}</h2>
          <div style="font-family: monospace; font-size: 0.85rem; color: var(--text-muted);">ID: ${item._id || item.id} | Type: ${item.type.toUpperCase()}</div>
        </div>
        
        <div style="background-color: var(--bg-secondary); padding: 1rem; border-radius: var(--radius-md);">
          <div style="margin-bottom: 0.5rem;"><strong>Reporter:</strong> ${item.reporterName}</div>
          <div style="margin-bottom: 0.5rem;"><strong>Contact:</strong> ${item.reporterContact}</div>
          <div style="margin-bottom: 0.5rem;"><strong>Location:</strong> ${item.location}</div>
          <div><strong>Date:</strong> ${formatDate(item.date)}</div>
        </div>
        
        <div>
          <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase;">Description</h4>
          <p style="font-size: 0.95rem;">${item.description}</p>
        </div>
        
        ${claimsHtml}
        ${actionHtml}
      </div>
    `;

    toggleModal('modal-admin-detail', true);

    const btnVerify = document.getElementById('btn-admin-verify');
    if (btnVerify) {
      btnVerify.addEventListener('click', async () => {
        try {
          const token = localStorage.getItem('lcu_findme_token');
          const res = await fetch(`${API_URL}/items/${item._id}/resolve`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            // --- Verification Log: record handover ---
            const claimant = (item.verificationClaims && item.verificationClaims.length > 0)
              ? item.verificationClaims[item.verificationClaims.length - 1]
              : null;
            appendVerifLog({
              itemTitle:    item.title,
              itemId:       item._id || item.id,
              claimantName: claimant ? claimant.claimantName : 'Walk-in Claimant',
              claimantId:   claimant ? claimant.claimantMatric : 'N/A',
              officerName:  adminName,
              timestamp:    new Date().toISOString()
            });
            // -----------------------------------------
            await loadData();
            toggleModal('modal-admin-detail', false);
          } else {
            alert('Failed to resolve/approve claims. Ensure you are authorized.');
          }
        } catch (err) {
          alert('Network connection error.');
        }
      });
    }

    const btnDelete = document.getElementById('btn-admin-delete');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        if(confirm("Are you sure you want to delete this record entirely?")) {
          try {
            const token = localStorage.getItem('lcu_findme_token');
            const res = await fetch(`${API_URL}/items/${item._id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (res.ok) {
              await loadData();
              toggleModal('modal-admin-detail', false);
            } else {
              alert('Failed to delete item. Ensure you are authorized.');
            }
          } catch (err) {
            alert('Network connection error.');
          }
        }
      });
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Unknown Date';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return d.toLocaleDateString(undefined, options);
  }

  // Scanner Logic
  const navScanner = document.getElementById('nav-scanner');
  let html5QrcodeScanner = null;

  function stopScanner() {
    if (html5QrcodeScanner) {
      html5QrcodeScanner.clear().catch(err => console.error("Error clearing scanner:", err));
      html5QrcodeScanner = null;
      // Restore default camera preview text icon
      document.getElementById('reader').innerHTML = `
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 2px; background-color: var(--primary); box-shadow: 0 0 8px var(--primary); animation: scan 2s infinite linear; z-index: 1;"></div>
        <div style="padding: 3rem 0; font-size: 3rem; opacity: 0.2;">📷</div>
      `;
    }
  }

  if (navScanner) {
    navScanner.addEventListener('click', () => {
      toggleModal('modal-scanner', true);
      
      // Initialize scanner
      html5QrcodeScanner = new Html5Qrcode("reader");
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => {
          // Success callback
          stopScanner();
          toggleModal('modal-scanner', false);
          
          // Parse item id from URL query parameters (e.g. ?item=60b8...) or raw id string
          let itemId = decodedText;
          if (decodedText.includes('item=')) {
            const urlObj = new URL(decodedText);
            itemId = urlObj.searchParams.get('item');
          }

          const exists = adminItems.find(i => 
            (i._id || i.id) === itemId || 
            (i._id || i.id).endsWith(itemId)
          );
          
          if (exists) {
            openAdminDetail(exists._id || exists.id);
          } else {
            alert(`Item ID "${itemId}" not found in database.`);
          }
        },
        (errorMessage) => {
          // Silent failure callback (occurs continuously during seek)
        }
      ).catch(err => {
        console.error("Failed to start webcam scanner:", err);
      });
    });
  }

  document.getElementById('btn-close-scanner').addEventListener('click', () => {
    stopScanner();
    toggleModal('modal-scanner', false);
  });
  
  document.getElementById('btn-close-admin-detail').addEventListener('click', () => toggleModal('modal-admin-detail', false));

  // Manual Scan lookup override
  const btnManualScan = document.getElementById('btn-manual-scan');
  if (btnManualScan) {
    btnManualScan.addEventListener('click', () => {
      let inputId = document.getElementById('manual-scan-input').value.trim();
      if (!inputId) return;
      
      stopScanner();
      
      const exists = adminItems.find(i => 
        (i._id || i.id) === inputId || 
        (i._id || i.id).endsWith(inputId) ||
        (i._id || i.id).replace('item-', '') === inputId
      );
      if (exists) {
        toggleModal('modal-scanner', false);
        document.getElementById('manual-scan-input').value = '';
        openAdminDetail(exists._id || exists.id);
      } else {
        alert("Item ID not found in database.");
      }
    });
  }

  // Edit Admin Profile Logic
  let adminName = localStorage.getItem('lcu_findme_admin_name') || 'CSO Olabisi';
  
  function updateAdminHeader() {
    const nameEl = document.getElementById('admin-header-username');
    const avatarEl = document.getElementById('admin-header-avatar');
    if (nameEl) nameEl.textContent = adminName;
    if (avatarEl) {
      const parts = adminName.split(' ');
      let initials = parts[0].charAt(0);
      if(parts.length > 1) {
        initials = parts[parts.length - 1].charAt(0);
      }
      avatarEl.textContent = initials.toUpperCase();
    }
  }

  const btnEditAdminProfile = document.getElementById('btn-edit-admin-profile');
  const btnCloseEditAdminProfile = document.getElementById('btn-close-edit-admin-profile');
  const formEditAdminProfile = document.getElementById('form-edit-admin-profile');

  if (btnEditAdminProfile) {
    btnEditAdminProfile.addEventListener('click', () => {
      document.getElementById('edit-admin-name').value = adminName;
      toggleModal('modal-edit-admin-profile', true);
    });
  }

  if (btnCloseEditAdminProfile) {
    btnCloseEditAdminProfile.addEventListener('click', () => toggleModal('modal-edit-admin-profile', false));
  }

  if (formEditAdminProfile) {
    formEditAdminProfile.addEventListener('submit', (e) => {
      e.preventDefault();
      const newName = document.getElementById('edit-admin-name').value.trim();
      if (newName) {
        adminName = newName;
        localStorage.setItem('lcu_findme_admin_name', adminName);
        updateAdminHeader();
        toggleModal('modal-edit-admin-profile', false);
        alert('Admin profile updated successfully.');
      }
    });
  }

  initTheme();
  loadData();
  updateAdminHeader();

  // ============================================================
  // VERIFICATION LOG — TAB SWITCHING
  // ============================================================
  const navDashboard  = document.getElementById('nav-dashboard');
  const navVerifLog   = document.getElementById('nav-verif-log');
  const sectionDash   = document.getElementById('section-dashboard');
  const sectionLog    = document.getElementById('section-verif-log');

  function showAdminSection(which) {
    if (which === 'dashboard') {
      sectionDash.classList.remove('hidden');
      sectionLog.classList.remove('active');
      navDashboard.classList.add('active');
      navVerifLog.classList.remove('active');
    } else {
      sectionDash.classList.add('hidden');
      sectionLog.classList.add('active');
      navDashboard.classList.remove('active');
      navVerifLog.classList.add('active');
      renderVerifLog();
    }
  }

  if (navDashboard) navDashboard.addEventListener('click', (e) => { e.preventDefault(); showAdminSection('dashboard'); });
  if (navVerifLog)  navVerifLog.addEventListener('click',  (e) => { e.preventDefault(); showAdminSection('log'); });

  // Export CSV button
  const btnExportCSV = document.getElementById('btn-export-csv');
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', exportVerifLogCSV);
  }

  // Initial log render to set stats/badge
  renderVerifLog();

  // HAMBURGER MENU
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const mainNav = document.getElementById('main-nav');

  if (hamburgerBtn && mainNav) {
    hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mainNav.classList.toggle('open');
      hamburgerBtn.classList.toggle('open');
    });

    // Close menu when clicking navigation links
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        hamburgerBtn.classList.remove('open');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && e.target !== hamburgerBtn) {
        mainNav.classList.remove('open');
        hamburgerBtn.classList.remove('open');
      }
    });
  }
});

// ============================================================
// VERIFICATION LOG — DATA FUNCTIONS
// ============================================================
const VERIF_LOG_KEY = 'lcu_findme_verif_log';

function getVerifLog() {
  try {
    return JSON.parse(localStorage.getItem(VERIF_LOG_KEY) || '[]');
  } catch { return []; }
}

function appendVerifLog(entry) {
  const log = getVerifLog();
  log.unshift(entry); // newest first
  localStorage.setItem(VERIF_LOG_KEY, JSON.stringify(log));
  renderVerifLog();
}

function renderVerifLog() {
  const log = getVerifLog();
  const tbody = document.getElementById('verif-log-tbody');
  if (!tbody) return;

  // Update summary stats
  updateLogStats(log);

  // Update nav badge
  const badge = document.getElementById('verif-log-badge');
  if (badge) {
    if (log.length > 0) {
      badge.textContent = log.length;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (log.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="verif-log-empty">
            <span class="verif-empty-icon">📚</span>
            No handovers recorded yet. Approve an item return to create the first log entry.
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  log.forEach((entry, idx) => {
    const tr = document.createElement('tr');
    if (idx === 0) tr.classList.add('log-row-new');
    
    const dt = new Date(entry.timestamp);
    const formattedDate = dt.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
    const formattedTime = dt.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
    const idShort = String(entry.itemId).substring(0, 10) + '...';
    
    tr.innerHTML = `
      <td data-label="Timestamp" class="log-timestamp">${formattedDate}<br>${formattedTime}</td>
      <td data-label="Item Name" style="font-weight: 600; color: var(--secondary);">${escapeHtml(entry.itemTitle)}</td>
      <td data-label="Item ID" style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${idShort}</td>
      <td data-label="Claimant" >${escapeHtml(entry.claimantName)}</td>
      <td data-label="Claimant ID" style="font-family: monospace; font-size: 0.85rem;">${escapeHtml(entry.claimantId)}</td>
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
    const todayCount = log.filter(e => new Date(e.timestamp).toDateString() === todayStr).length;
    todayEl.textContent = todayCount;
  }

  if (officerEl) {
    // Show current admin name from localStorage
    const currentAdmin = localStorage.getItem('lcu_findme_admin_name') || 'CSO Olabisi';
    officerEl.textContent = currentAdmin;
  }
}

function exportVerifLogCSV() {
  const log = getVerifLog();
  if (log.length === 0) {
    alert('No verification log entries to export.');
    return;
  }

  const headers = ['Timestamp', 'Item Name', 'Item ID', 'Claimant Name', 'Matric / Staff ID', 'Officer Name'];
  const rows = log.map(e => [
    new Date(e.timestamp).toLocaleString(),
    e.itemTitle,
    e.itemId,
    e.claimantName,
    e.claimantId,
    e.officerName
  ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `LCU_Verification_Log_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

