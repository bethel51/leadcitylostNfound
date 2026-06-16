const API_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:'
  ? 'http://127.0.0.1:5000/api'
  : 'https://leadcitylostnfound.onrender.com/api';

// State Object
let state = {
  items: [],
  filters: {
    type: 'all',        // 'all', 'lost', 'found'
    category: 'all',    // 'all', 'electronics', 'documents', etc.
    search: ''
  },
  currentView: 'dashboard', // 'dashboard', 'my-items'
  currentUser: null, // Start unauthenticated
  tempUploadedImage: null,
  pendingMatchItem: null
};

// Auto-Match Engine matching logic
function findPotentialMatches(newReport) {
  const newTokens = newReport.title.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(token => token.length >= 3); // ignore small words (a, the, my, etc.)
  
  if (newTokens.length === 0) return null;
  
  // Look for opposite type in the same category
  const targetType = newReport.type === 'lost' ? 'found' : 'lost';
  
  for (let item of state.items) {
    if (item.status === 'active' && item.type === targetType && item.category === newReport.category) {
      const itemTokens = item.title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/);
        
      // Count matching tokens
      const matches = newTokens.filter(tok => itemTokens.includes(tok));
      if (matches.length > 0) {
        return item; // return first high-probability match
      }
    }
  }
  return null;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  await initData();
});

// Initialize theme from storage
function initTheme() {
  const currentTheme = localStorage.getItem('lcu_findme_theme') || 'light';
  if (currentTheme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

// Fetch items from the backend
async function fetchItems() {
  try {
    const { type, category, search } = state.filters;
    let url = `${API_URL}/items?type=${type}&category=${category}`;
    if (search.trim() !== '') {
      url += `&search=${encodeURIComponent(search)}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    state.items = data;
  } catch (error) {
    console.error('Error fetching items:', error);
  }
}

function syncLoginUI() {
  if (state.currentUser) {
    const authContainer = document.getElementById('auth-container');
    if (authContainer) authContainer.style.display = 'none';
    const profileMock = document.getElementById('user-profile-container');
    if (profileMock) {
      profileMock.style.display = 'flex';
      const nameSpan = profileMock.querySelector('span');
      if(nameSpan) nameSpan.textContent = state.currentUser.name;
      
      const avatar = profileMock.querySelector('.avatar');
      if(avatar) avatar.textContent = state.currentUser.name.charAt(0).toUpperCase();
    }
  }
}

// Load seed data if none exists in LocalStorage
async function initData() {
  const token = localStorage.getItem('lcu_findme_token');
  const savedUser = localStorage.getItem('lcu_findme_user');
  if (token && savedUser) {
    state.currentUser = JSON.parse(savedUser);
    syncLoginUI();
  }
  await fetchItems();
}

// UI Rendering Controller
async function render() {
  updateStats();
  await fetchItems();
  renderItems();
}

// SVG Fallback Icons for categories
const categoryIcons = {
  electronics: `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
  documents: `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
  accessories: `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="18" r="4"></circle><path d="M12 18V9.24a6 6 0 1 1 8 0V18"></path><line x1="12" y1="14" x2="20" y2="14"></line></svg>`,
  books: `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5v-15z"></path></svg>`,
  clothing: `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.38 3.46L16 6.14V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2.14L3.62 3.46a2 2 0 0 0-2.41.44l-1 1a2 2 0 0 0-.14 2.5L4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7l3.93-4.6a2 2 0 0 0-.14-2.5l-1-1a2 2 0 0 0-2.41-.44z"></path></svg>`,
  other: `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`
};

// Update Stats counters on Dashboard
function updateStats() {
  const total = state.items.length;
  const lost = state.items.filter(item => item.type === 'lost' && item.status !== 'returned').length;
  const returned = state.items.filter(item => item.status === 'returned').length;
  
  animateCounter('stat-total', total);
  animateCounter('stat-lost', lost);
  animateCounter('stat-returned', returned);
}

let counterTimers = {};
function animateCounter(id, targetValue) {
  const el = document.getElementById(id);
  if (!el) return;
  
  if (counterTimers[id]) {
    clearInterval(counterTimers[id]);
  }
  
  let current = parseInt(el.textContent) || 0;
  if (current === targetValue) return;
  
  const diff = targetValue - current;
  const step = diff > 0 ? 1 : -1;
  const duration = 400; // ms
  const intervalTime = Math.abs(Math.floor(duration / diff)) || 30;
  
  counterTimers[id] = setInterval(() => {
    current += step;
    el.textContent = current;
    if (current === targetValue) {
      clearInterval(counterTimers[id]);
      delete counterTimers[id];
    }
  }, intervalTime);
}

// Render Listings Grid based on filters and search
function renderItems() {
  const grid = document.getElementById('items-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  // Filter logic
  let filtered = state.items.filter(item => {
    // 1. View filter (My Reports vs All Dashboard)
    if (state.currentView === 'my-items') {
      if (!state.currentUser) return false;
      return item.reporterName === state.currentUser.name;
    }
    return true;
  });
  
  // Sort: Active items first, then newer items first
  filtered.sort((a, b) => {
    if (a.status === 'returned' && b.status !== 'returned') return 1;
    if (a.status !== 'returned' && b.status === 'returned') return -1;
    return new Date(b.date) - new Date(a.date);
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3 class="empty-title">No Items Found</h3>
        <p class="empty-desc">We couldn't find any listings matching your filters or search keywords. Try adjusting your query or report a new item.</p>
      </div>
    `;
    return;
  }
  
  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = `item-card ${item.status === 'returned' ? 'item-returned' : ''}`;
    card.setAttribute('data-id', item._id || item.id);
    
    // Handle image preview or category illustration fallback
    let imageHTML = '';
    if (item.image && item.image.startsWith('data:image')) {
      imageHTML = `<img src="${item.image}" alt="${item.title}">`;
    } else {
      const icon = categoryIcons[item.category] || categoryIcons['other'];
      imageHTML = `
        <div class="placeholder-illustration">
          ${icon}
          <div class="placeholder-text">${item.category}</div>
        </div>
      `;
    }
    
    const badgeText = item.status === 'returned' ? 'Returned' : (item.type === 'found' ? 'Found' : 'Lost');
    const badgeClass = item.status === 'returned' ? 'badge-found' : (item.type === 'found' ? 'badge-found' : 'badge-lost');
    const borderStyle = item.status === 'returned' ? 'border: 2px solid var(--success); opacity: 0.85;' : '';
    
    // Auto-Match badge: check if a potential match exists for this item
    let matchBadgeHTML = '';
    if (item.status === 'active') {
      const potentialMatch = findPotentialMatches(item);
      if (potentialMatch) {
        matchBadgeHTML = `<span class="card-badge badge-matched">✨ Matched</span>`;
      }
    }
    
    card.innerHTML = `
      <div class="card-image-area" style="${item.status === 'returned' ? 'opacity: 0.65;' : ''}">
        <span class="card-badge ${badgeClass}">${badgeText}</span>
        ${matchBadgeHTML}
        ${imageHTML}
      </div>
      <div class="card-content" style="${item.status === 'returned' ? 'opacity: 0.75;' : ''}">
        <div class="card-meta">
          <span>${formatDate(item.date)}</span>
          <span class="meta-dot"></span>
          <span style="text-transform: capitalize;">${item.category}</span>
        </div>
        <h3 class="card-title">${item.title}</h3>
        <p class="card-description">${item.description}</p>
        <div class="card-footer">
          <div class="card-location">
            <span class="card-location-icon">📍</span>
            <span>${item.location}</span>
          </div>
          <button class="btn btn-secondary btn-detail-trigger" style="padding: 0.4rem 0.9rem; font-size: 0.8rem;">
            ${item.status === 'returned' ? 'View Details' : 'Verify & Claim'}
          </button>
        </div>
      </div>
    `;
    
    // Open detail modal when card or button is clicked
    card.querySelector('.btn-detail-trigger').addEventListener('click', (e) => {
      e.stopPropagation();
      openDetailModal(item._id || item.id);
    });
    card.addEventListener('click', () => {
      openDetailModal(item._id || item.id);
    });
    
    grid.appendChild(card);
  });
}

// Formats date string to friendly readable format
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown Date';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleDateString(undefined, options);
}

// Modal Toggle Utility
function toggleModal(modalId, show = true) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  if (show) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  } else {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Show Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-notification');
  const msgEl = document.getElementById('toast-message');
  const iconEl = toast ? toast.querySelector('.toast-icon') : null;
  
  if (!toast || !msgEl) return;
  
  msgEl.textContent = message;
  
  // Set premium SVG icons based on type
  if (iconEl) {
    if (type === 'success') {
      iconEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else if (type === 'warning') {
      iconEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else if (type === 'info') {
      iconEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
  }
  
  // Reset the active class and trigger reflow for progress bar animation
  toast.classList.remove('active');
  void toast.offsetWidth; // trigger reflow
  toast.className = `toast toast-${type} active`;
  
  if (window.toastTimeout) {
    clearTimeout(window.toastTimeout);
  }
  
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove('active');
  }, 4000);
}

// Modal Detail Window Builder
function openDetailModal(itemId) {
  const item = state.items.find(i => (i._id || i.id) === itemId);
  if (!item) return;
  
  const detailBody = document.getElementById('detail-body');
  if (!detailBody) return;
  
  // Set up details view
  let imageHTML = '';
  if (item.image && item.image.startsWith('data:image')) {
    imageHTML = `<img src="${item.image}" alt="${item.title}">`;
  } else {
    const icon = categoryIcons[item.category] || categoryIcons['other'];
    imageHTML = `
      <div class="placeholder-illustration">
        ${icon}
        <div class="placeholder-text" style="font-size: 1rem; margin-top: 0.5rem;">${item.category}</div>
      </div>
    `;
  }
  
  // Claim state or contact section
  let actionSection = '';
  
  if (item.status === 'returned') {
    actionSection = `
      <div class="verification-box claimed">
        <div class="verification-title">🎉 Item Successfully Returned</div>
        <p>This item has been successfully claimed by its rightful owner after passing verification checks.</p>
      </div>
    `;
  } else if (item.type === 'found') {
    actionSection = `
      <div class="verification-box" id="claim-verification-section">
        <div class="verification-title">📍 LCU In-Person Claim Verification</div>
        <p style="font-size: 0.88rem; margin-bottom: 0.75rem;">
          To retrieve this found item, please visit the <strong>LCU Security Office (Senate Building)</strong> in person. 
          A security officer will perform an in-person check (e.g., matching ID, describing details, or unlocking devices).
        </p>
        <div style="background-color: var(--bg-tertiary); padding: 0.75rem; border-radius: var(--radius-sm); border-left: 3px solid var(--primary); margin-bottom: 1rem; font-size: 0.8rem;">
          <strong>Security Office Hours:</strong> 8:00 AM - 5:00 PM (Monday - Friday)
        </div>
        <button class="btn btn-primary" id="btn-start-claim" style="width: 100%; justify-content: center;">
          Notify Security I'm Coming to Claim
        </button>
        
        <form id="form-claim-verification" style="display: none; margin-top: 1.25rem; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
          <div class="form-group">
            <label class="form-label" for="claim-desc">Briefly specify how you will prove ownership in person</label>
            <textarea class="form-control" id="claim-desc" placeholder="e.g. I have the passcode, I can describe the engraving, showing student ID..." required></textarea>
          </div>
          <div class="form-group" style="display: none;">
            <input type="text" class="form-control" id="claim-time" value="In Person Visit">
            <input type="text" class="form-control" id="claim-phone" value="Verified In Person">
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center;">
            Submit Claim Visit Notice
          </button>
        </form>
      </div>
    `;
  } else {
    // Lost Item detail view: Contact owner to return
    actionSection = `
      <div class="verification-box" style="background-color: var(--primary-light); border-color: rgba(37, 99, 235, 0.2);">
        <div class="verification-title">🙋 Did you find this item?</div>
        <p>If you have found this item or have any information, please reach out to the reporter immediately.</p>
        <div style="background-color: white; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1rem;">
          <div style="font-size: 0.85rem; color: var(--text-muted);">Reporter</div>
          <div style="font-weight: 700; color: var(--secondary); margin-bottom: 0.5rem;">${item.reporterName}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">Contact Details</div>
          <div style="font-family: monospace; font-weight: 600; color: var(--primary);">${item.reporterContact}</div>
        </div>
        <button class="btn btn-primary" id="btn-mark-returned-lost" style="width: 100%; justify-content: center;">
          I Have Returned This Item
        </button>
      </div>
    `;
  }

  detailBody.innerHTML = `
    <div class="detail-layout">
      <div class="detail-image">
        ${imageHTML}
      </div>
      
      <div>
        <h2 style="font-size: 1.5rem; margin-bottom: 0.5rem;">${item.title}</h2>
        <div class="detail-info-row">
          <div class="info-item">
            <h4>Encountered Location</h4>
            <p>📍 ${item.location}</p>
          </div>
          <div class="info-item">
            <h4>Date Logged</h4>
            <p>📅 ${formatDate(item.date)}</p>
          </div>
          <div class="info-item">
            <h4>Reported By</h4>
            <p>👤 ${item.reporterName}</p>
          </div>
          <div class="info-item">
            <h4>Item Category</h4>
            <p style="text-transform: capitalize;">📦 ${item.category}</p>
          </div>
        </div>
      </div>
      
      <div>
        <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">Description</h3>
        <p class="detail-description">${item.description}</p>
      </div>
      
      ${actionSection}
      ${item.type === 'found' && item.status !== 'returned' ? `
        <button class="btn btn-secondary" id="btn-generate-tag-qr" style="width: 100%; justify-content: center; gap: 0.5rem; margin-top: 1rem;">
          🖨️ Create Security Tag QR Label
        </button>
      ` : ''}
    </div>
  `;
  
  toggleModal('modal-detail', true);
  
  // Attach QR Label generator trigger
  const btnGenQR = document.getElementById('btn-generate-tag-qr');
  if (btnGenQR) {
    btnGenQR.addEventListener('click', () => {
      document.getElementById('qr-label-title').textContent = item.title;
      document.getElementById('qr-label-id').textContent = item.id;
      document.getElementById('qr-label-category').textContent = item.category;
      document.getElementById('qr-label-location').textContent = item.location;
      
      const qrCanvas = document.getElementById('qr-canvas');
      const baseUrl = window.location.origin !== "null" ? window.location.origin + window.location.pathname : 'https://lcufindme.edu.ng';
      const itemUrl = `${baseUrl}?item=${item._id || item.id}`;
      window.QRCode.draw(itemUrl, qrCanvas, { size: 120, margin: 5, color: '#0f172a' });
      
      toggleModal('modal-qr', true);
    });
  }
  
  // Attach Verification flow interactive events
  const btnStartClaim = document.getElementById('btn-start-claim');
  const claimForm = document.getElementById('form-claim-verification');
  if (btnStartClaim && claimForm) {
    btnStartClaim.addEventListener('click', () => {
      btnStartClaim.style.display = 'none';
      claimForm.style.display = 'block';
      claimForm.scrollIntoView({ behavior: 'smooth' });
    });
    
    claimForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const claimantName = state.currentUser ? state.currentUser.name : 'Anonymous Student';
      const claimantMatric = state.currentUser ? state.currentUser.matricNumber : 'LCU/UG/00/00000';
      const claimDetails = document.getElementById('claim-desc').value;
      
      try {
        const token = localStorage.getItem('lcu_findme_token');
        const res = await fetch(`${API_URL}/items/${item._id}/claim`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ claimantName, claimantMatric, claimDetails })
        });
        if (res.ok) {
          await fetch(`${API_URL}/items/${item._id}/resolve`, { 
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          toggleModal('modal-detail', false);
          render();
          showToast(`Verification submitted successfully! The item is now marked as Returned.`);
        } else {
          showToast('Failed to submit claim verification request.', 'error');
        }
      } catch (err) {
        showToast('Connection error connecting to backend.', 'error');
      }
    });
  }
  
  // Return button for lost items
  const btnMarkReturnedLost = document.getElementById('btn-mark-returned-lost');
  if (btnMarkReturnedLost) {
    btnMarkReturnedLost.addEventListener('click', async () => {
      try {
        const token = localStorage.getItem('lcu_findme_token');
        const res = await fetch(`${API_URL}/items/${item._id}/resolve`, { 
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          toggleModal('modal-detail', false);
          render();
          showToast(`Item successfully marked as Returned! Thank you for your honesty.`);
        } else {
          showToast('Failed to mark item as returned.', 'error');
        }
      } catch (err) {
        showToast('Connection error connecting to backend.', 'error');
      }
    });
  }
}

// Event Listeners Binding
function setupEventListeners() {
  // Theme Toggle Event Listener
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      const newTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
      localStorage.setItem('lcu_findme_theme', newTheme);
    });
  }

  // Modal toggle events
  const btnReportHeader = document.getElementById('btn-report-header');
  const btnReportHero = document.getElementById('btn-report-hero');
  const btnCloseReport = document.getElementById('btn-close-report');
  
  const openReportForm = () => {
    // Check if user is authenticated first
    if (!state.currentUser) {
      showToast('Please log in or create an account to report items.', 'warning');
      openAuthModal('login');
      return;
    }

    // Reset form states
    document.getElementById('form-report').reset();
    state.tempUploadedImage = null;
    document.getElementById('preview-container').style.display = 'none';
    document.getElementById('upload-zone').style.display = 'block';
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('report-date').value = today;
    
    // Set Reporter to current active user
    document.getElementById('report-reporter').value = state.currentUser.name;
    document.getElementById('report-contact').value = state.currentUser.contact;
    
    toggleModal('modal-report', true);
  };
  
  if (btnReportHeader) btnReportHeader.addEventListener('click', openReportForm);
  if (btnReportHero) btnReportHero.addEventListener('click', openReportForm);
  if (btnCloseReport) btnCloseReport.addEventListener('click', () => toggleModal('modal-report', false));
  
  const btnCloseDetail = document.getElementById('btn-close-detail');
  if (btnCloseDetail) btnCloseDetail.addEventListener('click', () => toggleModal('modal-detail', false));
  
  // Stop click propagation on all modal containers so button clicks don't leak to backdrop
  document.querySelectorAll('.modal-container').forEach(container => {
    container.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  // Close modals ONLY when clicking the backdrop itself (not any child element)
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      // Only close if the click target is the backdrop itself, not anything inside
      if (e.target === backdrop) {
        toggleModal(backdrop.id, false);
      }
    });
  });

  // Report Type selections (I Found / I Lost toggles)
  const typeFoundBtn = document.getElementById('type-select-found');
  const typeLostBtn = document.getElementById('type-select-lost');
  let selectedReportType = 'found'; // default
  
  if (typeFoundBtn && typeLostBtn) {
    typeFoundBtn.addEventListener('click', () => {
      selectedReportType = 'found';
      typeFoundBtn.classList.add('active');
      typeLostBtn.classList.remove('active');
      document.getElementById('report-modal-title').textContent = "Report Found Item";
    });
    
    typeLostBtn.addEventListener('click', () => {
      selectedReportType = 'lost';
      typeLostBtn.classList.add('active');
      typeFoundBtn.classList.remove('active');
      document.getElementById('report-modal-title').textContent = "Report Lost Item";
    });
  }

  // File Upload Logic (Drag and Drop + Fallback)
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const previewContainer = document.getElementById('preview-container');
  const previewImage = document.getElementById('preview-image');
  const btnRemovePreview = document.getElementById('btn-remove-preview');
  
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click());
    
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });
    
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });
    
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleImageFile(e.dataTransfer.files[0]);
      }
    });
    
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleImageFile(e.target.files[0]);
      }
    });
  }
  
  if (btnRemovePreview) {
    btnRemovePreview.addEventListener('click', () => {
      state.tempUploadedImage = null;
      previewContainer.style.display = 'none';
      uploadZone.style.display = 'block';
      fileInput.value = '';
    });
  }

  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.', 'error');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      // Compress/resize image using a lightweight canvas mechanism to prevent localStorage overflows
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert to scaled down jpeg
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        state.tempUploadedImage = compressedBase64;
        
        previewImage.src = compressedBase64;
        uploadZone.style.display = 'none';
        previewContainer.style.display = 'block';

        // Check if category is documents to run AI OCR Simulation
        const categoryVal = document.getElementById('report-category').value;
        if (categoryVal === 'documents') {
          showToast('🤖 AI OCR: Scanning document/ID card details...', 'info');
          
          setTimeout(() => {
            // Generate some realistic student details
            const mockStudents = [
              { name: "Adebayo Johnson", matric: "LCU/UG/24/09322", dept: "Computer Science", faculty: "Computing & Applied Sciences" },
              { name: "Chinedu Okafor", matric: "LCU/UG/23/11245", dept: "Software Engineering", faculty: "Computing & Applied Sciences" },
              { name: "Amina Yusuf", matric: "LCU/UG/22/08331", dept: "Law", faculty: "Law" },
              { name: "Olumide Alao", matric: "LCU/UG/24/10492", dept: "Nursing Science", faculty: "Medical Sciences" }
            ];
            const chosen = mockStudents[Math.floor(Math.random() * mockStudents.length)];
            
            // Auto-populate form fields
            const titleField = document.getElementById('report-title');
            const descField = document.getElementById('report-description');
            
            if (titleField) {
              titleField.value = `Found ID Card - ${chosen.name}`;
            }
            if (descField) {
              descField.value = `[AI OCR Scan details]\nName: ${chosen.name}\nMatric No: ${chosen.matric}\nFaculty: ${chosen.faculty}\nDepartment: ${chosen.dept}\n\nPlease verify details before claiming.`;
            }
            showToast(`✨ OCR Match: Extracted ID of ${chosen.name} (${chosen.matric})`, 'success');
          }, 1500);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Handle Form Submission
  const reportForm = document.getElementById('form-report');
  if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        title: document.getElementById('report-title').value.trim(),
        type: selectedReportType,
        category: document.getElementById('report-category').value,
        location: document.getElementById('report-location').value.trim(),
        date: document.getElementById('report-date').value,
        description: document.getElementById('report-description').value.trim(),
        reporterName: document.getElementById('report-reporter').value.trim(),
        reporterContact: document.getElementById('report-contact').value.trim(),
        image: state.tempUploadedImage || null
      };

      try {
        const token = localStorage.getItem('lcu_findme_token');
        const res = await fetch(`${API_URL}/items`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (res.ok) {
          const match = data.match;
          if (match) {
            state.tempPendingReport = data.item;
            state.pendingMatchItem = match;
            
            // Populate match modal preview card
            const resultsContainer = document.getElementById('match-results-container');
            let imageHTML = '';
            if (match.image && match.image.startsWith('data:image')) {
              imageHTML = `<img src="${match.image}" class="match-card-img" alt="${match.title}">`;
            } else {
              imageHTML = `<div class="match-card-img" style="color: var(--primary); font-size: 1.5rem;">📦</div>`;
            }
            
            resultsContainer.innerHTML = `
              <div class="match-card-item">
                ${imageHTML}
                <div class="match-card-details">
                  <div class="match-card-title">${match.title}</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                    📍 ${match.location} &nbsp;|&nbsp; 📅 ${formatDate(match.date)}
                  </div>
                  <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.3;">
                    ${match.description}
                  </p>
                </div>
              </div>
            `;
            
            toggleModal('modal-report', false);
            toggleModal('modal-match', true);
          } else {
            toggleModal('modal-report', false);
            render();
            showToast(`Successfully reported: "${data.item.title}"`);
            if (typeof addNotification === 'function') {
              addNotification(`📋 You reported a ${data.item.type} item: "${data.item.title}". Security has been notified.`);
            }
          }
        } else {
          showToast(data.message || 'Failed to submit report', 'error');
        }
      } catch (err) {
        showToast('Connection error connecting to backend.', 'error');
      }
    });
  }

  // Auto-Match Modal Button Handlers
  const btnMatchIgnore = document.getElementById('btn-match-ignore');
  if (btnMatchIgnore) {
    btnMatchIgnore.addEventListener('click', () => {
      toggleModal('modal-match', false);
      render();
      if (state.tempPendingReport) {
        showToast(`Successfully reported: "${state.tempPendingReport.title}"`);
        if (typeof addNotification === 'function') {
          addNotification(`📋 You reported a ${state.tempPendingReport.type} item: "${state.tempPendingReport.title}". Security has been notified.`);
        }
        state.tempPendingReport = null;
        state.pendingMatchItem = null;
      }
    });
  }

  const btnMatchView = document.getElementById('btn-match-view');
  if (btnMatchView) {
    btnMatchView.addEventListener('click', () => {
      if (state.pendingMatchItem) {
        const targetId = state.pendingMatchItem._id || state.pendingMatchItem.id;
        toggleModal('modal-match', false);
        openDetailModal(targetId);
        state.tempPendingReport = null;
        state.pendingMatchItem = null;
      }
    });
  }

  // Interactive SVG Map Toggling & Clicks
  const btnToggleMap = document.getElementById('btn-toggle-map');
  const mapContainer = document.getElementById('map-container');
  if (btnToggleMap && mapContainer) {
    btnToggleMap.addEventListener('click', () => {
      if (mapContainer.style.display === 'none') {
        mapContainer.style.display = 'block';
        btnToggleMap.textContent = "🙈 Hide Interactive Map";
      } else {
        mapContainer.style.display = 'none';
        btnToggleMap.textContent = "🗺️ Use Interactive Campus Map";
      }
    });
  }

  const mapBuildings = document.querySelectorAll('.map-building');
  mapBuildings.forEach(building => {
    building.addEventListener('click', () => {
      // Highlight selection
      mapBuildings.forEach(b => b.classList.remove('active'));
      building.classList.add('active');
      
      // Update form text value
      const locationName = building.getAttribute('data-name');
      const inputLoc = document.getElementById('report-location');
      if (inputLoc) {
        inputLoc.value = locationName;
        // Trigger style glow animation
        inputLoc.classList.add('glow');
        setTimeout(() => inputLoc.classList.remove('glow'), 800);
      }
    });
  });

  // Modal Closures for Phase 2 Modals
  const btnCloseMatch = document.getElementById('btn-close-match');
  if (btnCloseMatch) {
    btnCloseMatch.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleModal('modal-match', false);
    });
  }

  const btnCloseQr = document.getElementById('btn-close-qr');
  if (btnCloseQr) {
    btnCloseQr.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleModal('modal-qr', false);
    });
  }

  // QR Print Trigger
  const btnPrintQr = document.getElementById('btn-print-qr');
  if (btnPrintQr) {
    btnPrintQr.addEventListener('click', () => {
      window.print();
    });
  }

  // Tab Filtering (All vs Found vs Lost)
  const filterTabs = document.querySelectorAll('.filter-tab[data-type]');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.filters.type = tab.getAttribute('data-type');
      render();
    });
  });

  // Category Filtering (Chips)
  const categoryChips = document.querySelectorAll('.category-chip');
  categoryChips.forEach(chip => {
    chip.addEventListener('click', () => {
      categoryChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filters.category = chip.getAttribute('data-category');
      render();
    });
  });

  // Search Engine
  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');
  
  const executeSearch = () => {
    state.filters.search = searchInput.value;
    render();
    document.getElementById('listings-section').scrollIntoView({ behavior: 'smooth' });
  };
  
  if (searchButton) {
    searchButton.addEventListener('click', executeSearch);
  }
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        executeSearch();
      }
    });
  }

  // Navigation Links
  const navHome = document.getElementById('nav-home');
  const navMyItems = document.getElementById('nav-my-items');
  const sectionTitle = document.getElementById('section-title');
  
  if (navHome) {
    navHome.addEventListener('click', (e) => {
      e.preventDefault();
      navHome.classList.add('active');
      if (navMyItems) navMyItems.classList.remove('active');
      state.currentView = 'dashboard';
      if (sectionTitle) sectionTitle.textContent = "Recent Listings";
      render();
    });
  }
  
  if (navMyItems) {
    navMyItems.addEventListener('click', (e) => {
      e.preventDefault();
      if (!state.currentUser) {
        showToast('Please log in to view your reports.', 'warning');
        openAuthModal('login');
        return;
      }
      navMyItems.classList.add('active');
      if (navHome) navHome.classList.remove('active');
      state.currentView = 'my-items';
      if (sectionTitle) sectionTitle.textContent = "My Reported Listings";
      render();
    });
  }

  // Hero Scroll Button
  const btnScroll = document.getElementById('btn-scroll-dashboard');
  if (btnScroll) {
    btnScroll.addEventListener('click', () => {
      document.getElementById('listings-section').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // --- Auth Modal Logic ---
  const btnHeaderLogin = document.getElementById('btn-header-login');
  const btnHeaderSignup = document.getElementById('btn-header-signup');
  const btnCloseAuth = document.getElementById('btn-close-auth');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');
  const authModalTitle = document.getElementById('auth-modal-title');

  const openAuthModal = (view) => {
    if (formLogin) formLogin.reset();
    if (formSignup) formSignup.reset();
    
    toggleModal('modal-auth', true);
    if (view === 'login') {
      if(tabLogin) tabLogin.classList.add('active');
      if(tabSignup) tabSignup.classList.remove('active');
      if(formLogin) formLogin.style.display = 'block';
      if(formSignup) formSignup.style.display = 'none';
      if(authModalTitle) authModalTitle.textContent = "Welcome back to LCU FindMe";
    } else {
      if(tabSignup) tabSignup.classList.add('active');
      if(tabLogin) tabLogin.classList.remove('active');
      if(formSignup) formSignup.style.display = 'block';
      if(formLogin) formLogin.style.display = 'none';
      if(authModalTitle) authModalTitle.textContent = "Create LCU Student Account";
    }
  };

  if (btnHeaderLogin) btnHeaderLogin.addEventListener('click', () => openAuthModal('login'));
  if (btnHeaderSignup) btnHeaderSignup.addEventListener('click', () => openAuthModal('signup'));
  if (btnCloseAuth) btnCloseAuth.addEventListener('click', () => toggleModal('modal-auth', false));
  
  if (tabLogin) tabLogin.addEventListener('click', () => openAuthModal('login'));
  if (tabSignup) tabSignup.addEventListener('click', () => openAuthModal('signup'));

  const loginUser = (user, token) => {
    state.currentUser = user;
    localStorage.setItem('lcu_findme_token', token);
    localStorage.setItem('lcu_findme_user', JSON.stringify(user));

    if (user.role === 'admin') {
      showToast('Welcome Security Officer. Redirecting to admin console...');
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 1000);
      return;
    }
    
    const authContainer = document.getElementById('auth-container');
    if (authContainer) authContainer.style.display = 'none';
    const profileMock = document.getElementById('user-profile-container');
    if (profileMock) {
      profileMock.style.display = 'flex';
      const nameSpan = profileMock.querySelector('span');
      if(nameSpan) nameSpan.textContent = user.name;
      
      // Update avatar initials
      const avatar = profileMock.querySelector('.avatar');
      if(avatar) avatar.textContent = user.name.charAt(0).toUpperCase();
    }
    
    toggleModal('modal-auth', false);
  };

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('login-identifier').value;
      const password = document.getElementById('login-password').value;
      
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        
        if (res.ok) {
          loginUser(data.user, data.token);
          showToast('Successfully logged in.');
        } else if (res.status === 403 && data.requiresVerification) {
          // Account not verified — show OTP modal
          state.pendingVerifEmail = data.email;
          toggleModal('modal-auth', false);
          const otpDisplay = document.getElementById('otp-email-display');
          if (otpDisplay) otpDisplay.textContent = data.email;
          toggleModal('modal-otp', true);
          showToast('Account not verified. Check your email for the OTP code.', 'warning');
        } else {
          showToast(data.message || 'Login failed', 'error');
        }
      } catch (err) {
        showToast('Connection error connecting to backend.', 'error');
      }
    });
  }

  // Signup Role toggle field logic
  const signupRole = document.getElementById('signup-role');
  const studentFields = document.getElementById('student-fields-container');
  const signupEmail = document.getElementById('signup-email');
  const signupEmailLabel = document.getElementById('signup-email-label');
  const btnSubmitSignup = document.getElementById('btn-submit-signup');

  if (signupRole && studentFields) {
    signupRole.addEventListener('change', () => {
      const selectedRole = signupRole.value;
      if (selectedRole === 'student') {
        studentFields.style.display = 'block';
        document.getElementById('signup-matric').required = true;
        document.getElementById('signup-level').required = true;
        document.getElementById('signup-faculty').required = true;
        document.getElementById('signup-dept').required = true;
        if (signupEmail) {
          signupEmail.required = true;
          signupEmailLabel.textContent = "University Email *";
        }
        if (btnSubmitSignup) btnSubmitSignup.textContent = "Create Student Account";
      } else {
        studentFields.style.display = 'none';
        document.getElementById('signup-matric').required = false;
        document.getElementById('signup-level').required = false;
        document.getElementById('signup-faculty').required = false;
        document.getElementById('signup-dept').required = false;
        if (signupEmail) {
          signupEmail.required = true;
          signupEmailLabel.textContent = "Official Email *";
        }
        
        if (selectedRole === 'staff') {
          if (btnSubmitSignup) btnSubmitSignup.textContent = "Create Staff Account";
        } else if (selectedRole === 'admin') {
          if (btnSubmitSignup) btnSubmitSignup.textContent = "Create Security Account";
        }
      }
    });
  }

  if (formSignup) {
    formSignup.addEventListener('submit', async (e) => {
      e.preventDefault();
      const role = document.getElementById('signup-role').value;
      const name = document.getElementById('signup-name').value;
      const email = document.getElementById('signup-email').value;
      const pass = document.getElementById('signup-password').value;
      const confirm = document.getElementById('signup-confirm').value;

      if (pass !== confirm) {
        alert("Passwords do not match!");
        return;
      }

      let payload = {
        role,
        name,
        email,
        password: pass
      };

      if (role === 'student') {
        payload.matricNumber = document.getElementById('signup-matric').value.toLowerCase();
        payload.level = document.getElementById('signup-level').value;
        payload.faculty = document.getElementById('signup-faculty').value;
        payload.department = document.getElementById('signup-dept').value;
      }
      
      try {
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (res.ok && data.requiresVerification) {
          // Show OTP verification modal
          state.pendingVerifEmail = data.email;
          toggleModal('modal-auth', false);
          const otpDisplay = document.getElementById('otp-email-display');
          if (otpDisplay) otpDisplay.textContent = data.email;
          toggleModal('modal-otp', true);
          showToast('Registration successful! Check your email for the verification code.');
        } else if (res.ok) {
          loginUser(data.user, data.token);
          showToast(`Account created successfully. Welcome to LCU FindMe!`);
        } else {
          showToast(data.message || 'Registration failed', 'error');
        }
      } catch (err) {
        showToast('Connection error connecting to backend.', 'error');
      }
    });
  }

  // Logout Logic
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      state.currentUser = null;
      localStorage.removeItem('lcu_findme_token');
      localStorage.removeItem('lcu_findme_user');
      const profileMock = document.getElementById('user-profile-container');
      const authContainer = document.getElementById('auth-container');
      
      if (profileMock) profileMock.style.display = 'none';
      if (authContainer) authContainer.style.display = 'flex';
      
      showToast('You have securely logged out.');
      
      // Redirect to dashboard if on protected route
      if (state.currentView === 'my-items') {
        const navHome = document.getElementById('nav-home');
        if (navHome) navHome.click();
      } else {
        render();
      }
    });
  }

  // Edit Profile Logic
  const btnEditProfile = document.getElementById('btn-edit-profile');
  const btnCloseEditProfile = document.getElementById('btn-close-edit-profile');
  const formEditProfile = document.getElementById('form-edit-profile');

  if (btnEditProfile) {
    btnEditProfile.addEventListener('click', () => {
      if (state.currentUser) {
        document.getElementById('edit-profile-name').value = state.currentUser.name || '';
        document.getElementById('edit-profile-contact').value = state.currentUser.contact || '';
        document.getElementById('edit-profile-matric').value = state.currentUser.matric || '';
        document.getElementById('edit-profile-dept').value = state.currentUser.dept || '';
        document.getElementById('edit-profile-phone').value = state.currentUser.phone || '';
        
        // Live avatar preview
        const avatarPreview = document.getElementById('edit-avatar-preview');
        if (avatarPreview) avatarPreview.textContent = (state.currentUser.name || 'U').charAt(0).toUpperCase();
        
        // Wire live update
        const nameInput = document.getElementById('edit-profile-name');
        nameInput.oninput = () => {
          if (avatarPreview) avatarPreview.textContent = (nameInput.value || 'U').charAt(0).toUpperCase();
        };
        
        toggleModal('modal-edit-profile', true);
      }
    });
  }

  if (btnCloseEditProfile) {
    btnCloseEditProfile.addEventListener('click', () => {
      toggleModal('modal-edit-profile', false);
    });
  }

  if (formEditProfile) {
    formEditProfile.addEventListener('submit', (e) => {
      e.preventDefault();
      const newName = document.getElementById('edit-profile-name').value.trim();
      const newContact = document.getElementById('edit-profile-contact').value.trim();
      
      if (newName) {
        // Update user object fields
        state.currentUser.name = newName;
        state.currentUser.contact = newContact || state.currentUser.contact;
        state.currentUser.matric = document.getElementById('edit-profile-matric').value.trim();
        state.currentUser.dept   = document.getElementById('edit-profile-dept').value.trim();
        state.currentUser.phone  = document.getElementById('edit-profile-phone').value.trim();
        
        // Persist to localStorage
        localStorage.setItem('lcu_findme_user', JSON.stringify(state.currentUser));

        // Sync UI
        syncLoginUI();
        toggleModal('modal-edit-profile', false);
        showToast('Profile updated successfully.');
      }
    });
  }

  // ============================================================
  // OTP VERIFICATION MODAL LOGIC
  // ============================================================
  const btnCloseOtp = document.getElementById('btn-close-otp');
  if (btnCloseOtp) btnCloseOtp.addEventListener('click', () => toggleModal('modal-otp', false));

  // OTP Digits Auto-focus & Paste handling logic
  const otpInputs = document.querySelectorAll('.otp-digit-input');
  const hiddenOtpCode = document.getElementById('otp-code');
  
  if (otpInputs.length > 0 && hiddenOtpCode) {
    const updateHiddenOtp = () => {
      let code = '';
      otpInputs.forEach(inp => code += inp.value);
      hiddenOtpCode.value = code;
    };

    otpInputs.forEach((input, index) => {
      input.addEventListener('focus', () => {
        input.select();
      });

      input.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val.length > 1) {
          e.target.value = val.slice(-1);
        }
        
        if (e.target.value && index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        }
        
        updateHiddenOtp();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!input.value && index > 0) {
            otpInputs[index - 1].value = '';
            otpInputs[index - 1].focus();
          } else {
            input.value = '';
          }
          updateHiddenOtp();
          e.preventDefault();
        }
      });
      
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text').trim();
        if (/^\d{6}$/.test(text)) {
          otpInputs.forEach((inp, idx) => {
            inp.value = text[idx];
          });
          otpInputs[5].focus();
          updateHiddenOtp();
        }
      });
    });
  }

  const formVerifyOtp = document.getElementById('form-verify-otp');
  if (formVerifyOtp) {
    formVerifyOtp.addEventListener('submit', async (e) => {
      e.preventDefault();
      const otp = document.getElementById('otp-code').value.trim();
      const email = state.pendingVerifEmail;
      const errorMsg = document.getElementById('otp-error-msg');
      const verifyBtn = document.getElementById('btn-verify-otp');

      if (!email) {
        if (errorMsg) { errorMsg.textContent = 'Session expired. Please register again.'; errorMsg.style.display = 'block'; }
        return;
      }

      // Disable button and show loading state
      if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.6s linear infinite;"></span> Verifying...';
      }

      try {
        const res = await fetch(`${API_URL}/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp })
        });
        const data = await res.json();

        if (res.ok) {
          toggleModal('modal-otp', false);
          loginUser(data.user, data.token);
          showToast('Email verified successfully! Welcome to LCU FindMe!');
          state.pendingVerifEmail = null;
        } else {
          if (errorMsg) { errorMsg.textContent = data.message || 'Invalid verification code.'; errorMsg.style.display = 'block'; }
        }
      } catch (err) {
        if (errorMsg) { errorMsg.textContent = 'Connection error. Please try again.'; errorMsg.style.display = 'block'; }
      } finally {
        // Re-enable button
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.innerHTML = 'Verify Account';
        }
      }
    });
  }

  // Resend OTP button logic with cooldown
  const btnResendOtp = document.getElementById('btn-resend-otp');
  if (btnResendOtp) {
    btnResendOtp.addEventListener('click', async () => {
      const email = state.pendingVerifEmail;
      if (!email) {
        showToast('Session expired. Please register again.', 'error');
        return;
      }

      // Start cooldown
      btnResendOtp.disabled = true;
      let cooldown = 60;
      btnResendOtp.textContent = `Resend in ${cooldown}s`;
      const cooldownTimer = setInterval(() => {
        cooldown--;
        btnResendOtp.textContent = `Resend in ${cooldown}s`;
        if (cooldown <= 0) {
          clearInterval(cooldownTimer);
          btnResendOtp.disabled = false;
          btnResendOtp.textContent = "Didn't receive it? Resend Code";
        }
      }, 1000);

      try {
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, resendOtp: true })
        });
        showToast('A new verification code has been sent to your email.');
      } catch (err) {
        showToast('Failed to resend code. Please try again.', 'error');
      }
    });
  }

  // ============================================================
  // FORGOT PASSWORD MODAL LOGIC
  // ============================================================
  const btnCloseForgot = document.getElementById('btn-close-forgot');
  if (btnCloseForgot) btnCloseForgot.addEventListener('click', () => toggleModal('modal-forgot-password', false));

  const btnCloseReset = document.getElementById('btn-close-reset');
  if (btnCloseReset) btnCloseReset.addEventListener('click', () => toggleModal('modal-reset-password', false));

  // Wire "Forgot Password?" link in login form
  const forgotPasswordLink = document.querySelector('a[href="#"]');
  document.querySelectorAll('a[href="#"]').forEach(link => {
    if (link.textContent.trim() === 'Forgot Password?') {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        toggleModal('modal-auth', false);
        toggleModal('modal-forgot-password', true);
      });
    }
  });

  const formForgotPassword = document.getElementById('form-forgot-password');
  if (formForgotPassword) {
    formForgotPassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email').value.trim();
      const errorMsg = document.getElementById('forgot-error-msg');

      try {
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (res.ok) {
          toggleModal('modal-forgot-password', false);
          document.getElementById('reset-email-hidden').value = email;
          toggleModal('modal-reset-password', true);
          showToast('Reset code sent to your email!');
        } else {
          if (errorMsg) { errorMsg.textContent = data.message || 'Request failed.'; errorMsg.style.display = 'block'; }
        }
      } catch (err) {
        if (errorMsg) { errorMsg.textContent = 'Connection error. Please try again.'; errorMsg.style.display = 'block'; }
      }
    });
  }

  const formResetPassword = document.getElementById('form-reset-password');
  if (formResetPassword) {
    formResetPassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('reset-email-hidden').value;
      const otp = document.getElementById('reset-otp').value.trim();
      const newPassword = document.getElementById('reset-new-password').value;
      const confirmPassword = document.getElementById('reset-confirm-password').value;
      const errorMsg = document.getElementById('reset-error-msg');

      if (newPassword !== confirmPassword) {
        if (errorMsg) { errorMsg.textContent = 'Passwords do not match.'; errorMsg.style.display = 'block'; }
        return;
      }

      try {
        const res = await fetch(`${API_URL}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp, newPassword })
        });
        const data = await res.json();

        if (res.ok) {
          toggleModal('modal-reset-password', false);
          showToast('Password reset successful! You can now log in.');
          openAuthModal('login');
        } else {
          if (errorMsg) { errorMsg.textContent = data.message || 'Reset failed.'; errorMsg.style.display = 'block'; }
        }
      } catch (err) {
        if (errorMsg) { errorMsg.textContent = 'Connection error. Please try again.'; errorMsg.style.display = 'block'; }
      }
    });
  }
}

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================
const notifications = JSON.parse(localStorage.getItem('lcu_findme_notifs') || '[]');

function saveNotifs() {
  localStorage.setItem('lcu_findme_notifs', JSON.stringify(notifications));
}

function addNotification(message) {
  notifications.unshift({ message, time: new Date().toISOString(), read: false });
  if (notifications.length > 20) notifications.pop();
  saveNotifs();
  renderNotifications();
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  const badge = document.getElementById('notif-badge');
  if (!list) return;

  const unread = notifications.filter(n => !n.read).length;
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }

  if (notifications.length === 0) {
    list.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
    return;
  }

  list.innerHTML = notifications.map((n, i) => {
    let icon = '🔔';
    const msgLower = n.message.toLowerCase();
    if (msgLower.includes('approved') || msgLower.includes('success') || msgLower.includes('marked')) {
      icon = '✅';
    } else if (msgLower.includes('reject') || msgLower.includes('fail') || msgLower.includes('expired')) {
      icon = '❌';
    } else if (msgLower.includes('verify') || msgLower.includes('claim')) {
      icon = '🔒';
    } else if (msgLower.includes('match') || msgLower.includes('found')) {
      icon = '✨';
    }

    return `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-index="${i}">
        <div class="notif-icon-badge">${icon}</div>
        <div class="notif-content-wrapper">
          <div class="notif-message-text" style="font-weight: 500;">${n.message}</div>
          <span class="notif-time">${timeAgo(n.time)}</span>
        </div>
      </div>
    `;
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

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

// Bell toggle
const notifBell = document.getElementById('notif-bell');
const notifDropdown = document.getElementById('notif-dropdown');
const btnClearNotifs = document.getElementById('btn-clear-notifs');

if (notifBell && notifDropdown) {
  notifBell.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle('open');
    // Mark all read when opened
    notifications.forEach(n => n.read = true);
    saveNotifs();
    renderNotifications();
  });
}

if (btnClearNotifs) {
  btnClearNotifs.addEventListener('click', () => {
    notifications.length = 0;
    saveNotifs();
    renderNotifications();
    notifDropdown.classList.remove('open');
  });
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (notifDropdown && !notifDropdown.contains(e.target) && e.target !== notifBell) {
    notifDropdown.classList.remove('open');
  }
});

// ============================================================
// HAMBURGER MENU
// ============================================================
const hamburgerBtn = document.getElementById('hamburger-btn');
const mainNav = document.getElementById('main-nav');
if (hamburgerBtn && mainNav) {
  hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    mainNav.classList.toggle('open');
    hamburgerBtn.classList.toggle('open');
  });

  // Auto-dismiss mobile menu when a nav link is clicked
  mainNav.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('click', () => {
      mainNav.classList.remove('open');
      hamburgerBtn.classList.remove('open');
    });
  });

  document.addEventListener('click', (e) => {
    if (!mainNav.contains(e.target) && e.target !== hamburgerBtn) {
      mainNav.classList.remove('open');
      hamburgerBtn.classList.remove('open');
    }
  });
}

// Database-Backed Live Polling for Notifications
setInterval(async () => {
  if (!state.currentUser) return;
  try {
    const token = localStorage.getItem('lcu_findme_token');
    const res = await fetch(`${API_URL}/items/notifications`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      const dbNotifs = await res.json();
      
      // Inject any brand new notifications we haven't shown yet
      let newAdded = false;
      dbNotifs.forEach(notif => {
        const alreadyExists = notifications.some(existing => existing.message === notif.message);
        if (!alreadyExists) {
          notifications.unshift({
            message: notif.message,
            time: notif.time || new Date().toISOString(),
            read: false
          });
          newAdded = true;
          showToast(notif.message, 'info');
        }
      });
      
      if (newAdded) {
        saveNotifs();
        renderNotifications();
      }
    }
  } catch (err) {
    console.error('Error fetching live notifications:', err);
  }
}, 5000);

// Initial render
renderNotifications();
render();

// ============================================================
// INTERACTIVE ONBOARDING TOUR ENGINE
// ============================================================

const TOUR_STORAGE_KEY = 'lcu_findme_tour_done';
const TOUR_VERSION = 'v2'; // bump when steps change to force re-show

const tourSteps = [
  {
    targetId: 'btn-report-header',
    title: '📋 Report Lost or Found Items',
    body: 'Tap the <strong>"Report Item"</strong> button in the header to log anything you\'ve found on campus — or report an item you\'ve lost. It takes under a minute!',
    tooltipPos: 'below'
  },
  {
    targetId: 'btn-toggle-map',
    title: '🗺️ Interactive Campus Map',
    body: 'Inside the report form, click <strong>"Use Interactive Campus Map"</strong> to pin the exact location — like the Senate Building, FSS Cafe, or Library — instead of typing it.',
    tooltipPos: 'below',
    scrollToForm: true
  },
  {
    targetId: 'items-grid',
    title: '🔍 Browse Active Listings',
    body: 'All lost and found reports appear here on the dashboard. Use the <strong>filters and search bar</strong> above to quickly find an item. Click any card to verify a claim.',
    tooltipPos: 'above'
  },
  {
    targetId: 'nav-home',
    title: '🔒 Security QR Bin Tags',
    body: 'When you open a <strong>Found item\'s</strong> detail view, you can generate a <strong>Security Bin Tag QR Label</strong> to physically attach to the item at the Security Office.',
    tooltipPos: 'below',
    isLastStep: true
  }
];

let tourCurrentStep = 0;
let tourActive = false;

function initTour() {
  const done = localStorage.getItem(TOUR_STORAGE_KEY);
  if (done === TOUR_VERSION) return; // already completed this version
  
  // Delay so page renders first
  setTimeout(() => startTour(), 1200);
  
  // Replay button always visible
  const replayBtn = document.getElementById('btn-replay-tour');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      if (!tourActive) {
        tourCurrentStep = 0;
        startTour();
      }
    });
  }
}

function startTour() {
  tourActive = true;
  tourCurrentStep = 0;
  const overlay = document.getElementById('tour-overlay');
  if (overlay) overlay.classList.add('active');
  
  // Register tracking event listeners
  window.addEventListener('scroll', repositionTourElement, { passive: true });
  window.addEventListener('resize', repositionTourElement, { passive: true });
  
  showTourStep(tourCurrentStep);
  
  // Wire Next button
  const btnNext = document.getElementById('btn-tour-next');
  if (btnNext) {
    // Remove old listener by replacing element
    const newBtn = btnNext.cloneNode(true);
    btnNext.parentNode.replaceChild(newBtn, btnNext);
    newBtn.addEventListener('click', () => {
      tourCurrentStep++;
      if (tourCurrentStep >= tourSteps.length) {
        endTour();
      } else {
        showTourStep(tourCurrentStep);
      }
    });
  }
  
  // Wire Skip button
  const btnSkip = document.getElementById('btn-tour-skip');
  if (btnSkip) {
    const newSkip = btnSkip.cloneNode(true);
    btnSkip.parentNode.replaceChild(newSkip, btnSkip);
    newSkip.addEventListener('click', () => endTour());
  }
}

function repositionTourElement() {
  if (!tourActive) return;
  const step = tourSteps[tourCurrentStep];
  if (!step) return;
  const targetEl = document.getElementById(step.targetId);
  const tooltip = document.getElementById('tour-tooltip');
  const ring = document.getElementById('tour-spotlight-ring');
  if (!targetEl) return;

  const rect = targetEl.getBoundingClientRect();
  const PAD = 10;
  
  if (ring) {
    ring.style.top    = `${rect.top - PAD}px`;
    ring.style.left   = `${rect.left - PAD}px`;
    ring.style.width  = `${rect.width + PAD * 2}px`;
    ring.style.height = `${rect.height + PAD * 2}px`;
  }
  
  if (tooltip) {
    const TIP_W = 320;
    const TIP_H = 190;
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    
    let top, left;
    const MARGIN = 16;
    
    if (step.tooltipPos === 'below' && rect.bottom + TIP_H + MARGIN < viewH) {
      top  = rect.bottom + MARGIN;
      left = Math.max(MARGIN, Math.min(viewW - TIP_W - MARGIN, rect.left + rect.width / 2 - TIP_W / 2));
    } else if (step.tooltipPos === 'above' && rect.top - TIP_H - MARGIN > 0) {
      top  = rect.top - TIP_H - MARGIN;
      left = Math.max(MARGIN, Math.min(viewW - TIP_W - MARGIN, rect.left + rect.width / 2 - TIP_W / 2));
    } else {
      top  = Math.max(MARGIN, viewH / 2 - TIP_H / 2);
      left = Math.max(MARGIN, viewW / 2 - TIP_W / 2);
    }
    
    tooltip.style.top  = `${top}px`;
    tooltip.style.left = `${left}px`;
  }
}

function showTourStep(stepIndex) {
  const step = tourSteps[stepIndex];
  if (!step) { endTour(); return; }
  
  // Update tooltip content
  const pill = document.getElementById('tour-step-pill');
  const title = document.getElementById('tour-tooltip-title');
  const body = document.getElementById('tour-tooltip-body');
  const nextBtn = document.getElementById('btn-tour-next');
  
  if (pill) pill.textContent = `Step ${stepIndex + 1} of ${tourSteps.length}`;
  if (title) title.textContent = step.title;
  if (body) body.innerHTML = step.body;
  if (nextBtn) {
    if (step.isLastStep) {
      nextBtn.innerHTML = 'Done! 🎉';
    } else {
      nextBtn.innerHTML = 'Next <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6"/></svg>';
    }
  }
  
  // Update progress dots
  const dots = document.querySelectorAll('.tour-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === stepIndex);
  });
  
  // Find and highlight target
  const targetEl = document.getElementById(step.targetId);
  const tooltip = document.getElementById('tour-tooltip');
  const ring = document.getElementById('tour-spotlight-ring');
  
  if (!targetEl) {
    // If target not visible, skip this step
    tourCurrentStep++;
    if (tourCurrentStep < tourSteps.length) showTourStep(tourCurrentStep);
    else endTour();
    return;
  }
  
  // Add transitioning class for smooth move animation between steps
  if (ring) ring.classList.add('transitioning');
  if (tooltip) tooltip.classList.add('transitioning');
  
  // Scroll target into view
  targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Continuously reposition during smooth scrolling (approx 500ms duration)
  let scrollTime = 0;
  const scrollInterval = setInterval(() => {
    repositionTourElement();
    scrollTime += 30;
    if (scrollTime >= 600 || !tourActive) {
      clearInterval(scrollInterval);
    }
  }, 30);
  
  setTimeout(() => {
    repositionTourElement();
    if (ring) ring.classList.add('visible');
    if (tooltip) tooltip.classList.add('visible');
    
    // Remove transitioning after movement completes
    setTimeout(() => {
      if (ring) ring.classList.remove('transitioning');
      if (tooltip) tooltip.classList.remove('transitioning');
    }, 350);
  }, 100);
}

function endTour() {
  tourActive = false;
  
  window.removeEventListener('scroll', repositionTourElement);
  window.removeEventListener('resize', repositionTourElement);
  
  const overlay = document.getElementById('tour-overlay');
  const tooltip = document.getElementById('tour-tooltip');
  const ring    = document.getElementById('tour-spotlight-ring');
  
  if (overlay) overlay.classList.remove('active');
  if (tooltip) {
    tooltip.classList.remove('visible');
    tooltip.classList.remove('transitioning');
  }
  if (ring) {
    ring.classList.remove('visible');
    ring.classList.remove('transitioning');
  }
  
  // Mark tour as done
  localStorage.setItem(TOUR_STORAGE_KEY, TOUR_VERSION);
  
  // Bounce the replay button to indicate it's available
  const replayBtn = document.getElementById('btn-replay-tour');
  if (replayBtn) {
    replayBtn.classList.add('tour-finish-pulse');
    setTimeout(() => replayBtn.classList.remove('tour-finish-pulse'), 600);
  }
  
  // Scroll back to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Boot the tour after DOM is ready and initData has resolved
document.addEventListener('DOMContentLoaded', () => {
  // Give initData a moment to run first (it's already called in the other listener)
  setTimeout(initTour, 500);
  
  // Always wire replay button
  const replayBtn = document.getElementById('btn-replay-tour');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      if (!tourActive) {
        tourCurrentStep = 0;
        startTour();
      }
    });
  }
});
