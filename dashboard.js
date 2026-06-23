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
  currentView: 'dashboard', // 'dashboard', 'my-items', 'profile'
  currentUser: null,
  tempUploadedImage: null,
  pendingMatchItem: null
};

// Check authentication
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
  if (!checkAuth()) return;
  
  initTheme();
  setupEventListeners();
  await initData();
  checkUrlParams();
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
  const navProfile = document.getElementById('nav-profile');
  if (state.currentUser) {
    const profileMock = document.getElementById('user-profile-container');
    if (profileMock) {
      profileMock.style.display = 'flex';
      const nameSpan = profileMock.querySelector('span');
      if(nameSpan) nameSpan.textContent = state.currentUser.name;
      
      const avatar = profileMock.querySelector('.avatar');
      if(avatar) avatar.textContent = state.currentUser.name.charAt(0).toUpperCase();
    }
    if (navProfile) navProfile.style.display = 'inline-block';

    // Populate new My Profile view fields
    const cardAvatar = document.getElementById('profile-card-avatar');
    if (cardAvatar) cardAvatar.textContent = state.currentUser.name.charAt(0).toUpperCase();
    
    const cardName = document.getElementById('profile-card-name');
    if (cardName) cardName.textContent = state.currentUser.name;
    
    const cardRole = document.getElementById('profile-card-role');
    if (cardRole) {
      cardRole.textContent = state.currentUser.role || 'Student';
      cardRole.className = `status-badge ${state.currentUser.role === 'admin' ? 'status-returned' : 'status-active'}`;
    }
    
    const cardMatric = document.getElementById('profile-card-matric');
    if (cardMatric) cardMatric.textContent = state.currentUser.matricNumber || state.currentUser.matric || '—';
    
    const cardEmail = document.getElementById('profile-card-email');
    if (cardEmail) cardEmail.textContent = state.currentUser.email || state.currentUser.contact || '—';
    
    const cardFaculty = document.getElementById('profile-card-faculty');
    if (cardFaculty) cardFaculty.textContent = state.currentUser.faculty || '—';
    
    const cardDept = document.getElementById('profile-card-dept');
    if (cardDept) cardDept.textContent = state.currentUser.department || state.currentUser.dept || '—';
    
    const cardLevel = document.getElementById('profile-card-level');
    if (cardLevel) cardLevel.textContent = state.currentUser.level ? `${state.currentUser.level} Level` : '—';
    
    const cardPhone = document.getElementById('profile-card-phone');
    if (cardPhone) cardPhone.textContent = state.currentUser.phoneNumber || state.currentUser.phone || '—';
  } else {
    if (navProfile) navProfile.style.display = 'none';
  }
}

// Load data on start
async function initData() {
  syncLoginUI();
  fetchNotifications();
  await fetchItems();
  updateStats();
  renderItems();
}

// UI Rendering Controller
async function render() {
  await fetchItems();
  updateStats();
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
  const total = state.currentUser ? state.items.length : 0;
  const lost = state.currentUser ? state.items.filter(item => item.type === 'lost' && item.status !== 'returned').length : 0;
  const returned = state.currentUser ? state.items.filter(item => item.status === 'returned').length : 0;
  
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
    
    setTimeout(() => {
      const firstInput = modal.querySelector('.otp-digit-input, input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
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
      </div>
    `;
  } else {
    actionSection = `
      <div class="verification-box" style="background-color: var(--primary-light); border-color: rgba(37, 99, 235, 0.2);">
        <div class="verification-title">🙋 Did you find this item?</div>
        <p>If you have found this item or have any information, please reach out to the reporter immediately.</p>
        <div style="background-color: white; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 0rem;">
          <div style="font-size: 0.85rem; color: var(--text-muted);">Reporter</div>
          <div style="font-weight: 700; color: var(--secondary); margin-bottom: 0.5rem;">${item.reporterName}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">Contact Details</div>
          <div style="font-family: monospace; font-weight: 600; color: var(--primary);">${item.reporterContact}</div>
        </div>
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
  
  const btnGenQR = document.getElementById('btn-generate-tag-qr');
  if (btnGenQR) {
    btnGenQR.addEventListener('click', () => {
      document.getElementById('qr-label-title').textContent = item.title;
      document.getElementById('qr-label-id').textContent = item._id || item.id;
      document.getElementById('qr-label-category').textContent = item.category;
      document.getElementById('qr-label-location').textContent = item.location;
      
      const qrCanvas = document.getElementById('qr-canvas');
      const originUrl = window.location.origin !== "null" ? window.location.origin : 'https://lcufindme.edu.ng';
      let path = window.location.pathname;
      if (path.endsWith('dashboard.html') || path.endsWith('index.html')) {
        path = path.substring(0, path.lastIndexOf('/')) + '/slip.html';
      } else if (path.endsWith('/')) {
        path += 'slip.html';
      } else {
        path = '/slip.html';
      }
      const itemUrl = `${originUrl}${path}?item=${item._id || item.id}`;
      window.QRCode.draw(itemUrl, qrCanvas, { size: 120, margin: 5, color: '#0f172a' });
      
      toggleModal('modal-qr', true);
    });
  }
  
  const btnStartClaim = document.getElementById('btn-start-claim');
  if (btnStartClaim) {
    btnStartClaim.addEventListener('click', () => {
      const claimSection = document.getElementById('claim-verification-section');
      if (claimSection) {
        const defaultName = state.currentUser.name || '';
        const defaultMatric = state.currentUser.matricNumber || state.currentUser.email || '';
        
        claimSection.innerHTML = `
          <div class="verification-title" style="margin-bottom: 0.5rem;">📍 LCU In-Person Claim Verification</div>
          <p style="font-size: 0.82rem; margin-bottom: 0.75rem; color: var(--text-muted);">
            Please enter details to verify your ownership of this item before visiting the Security Office.
          </p>
          <form id="claim-details-form" style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left;">
            <div class="form-group">
              <label class="form-label" style="font-size: 0.8rem; margin-bottom: 0.25rem; display: block; font-weight: 600;">Claimant Name</label>
              <input type="text" class="form-control" id="claim-claimant-name" value="${defaultName}" style="padding: 0.5rem; width: 100%; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); color: var(--text-dark);" required>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 0.8rem; margin-bottom: 0.25rem; display: block; font-weight: 600;">Matric Number / Email</label>
              <input type="text" class="form-control" id="claim-claimant-matric" value="${defaultMatric}" style="padding: 0.5rem; width: 100%; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); color: var(--text-dark);" required>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 0.8rem; margin-bottom: 0.25rem; display: block; font-weight: 600;">Verification details (Description, passcode, contents, etc.)</label>
              <textarea class="form-control" id="claim-claimant-details" placeholder="Describe the item's unique characteristics, passcode details, contents, or other proof of ownership..." style="padding: 0.5rem; min-height: 80px; width: 100%; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); color: var(--text-dark); font-family: inherit; resize: vertical;" required></textarea>
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
              <button type="button" class="btn btn-secondary" id="btn-cancel-claim" style="flex: 1; justify-content: center; font-size: 0.85rem; padding: 0.5rem;">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btn-submit-claim-form" style="flex: 2; justify-content: center; font-size: 0.85rem; padding: 0.5rem;">Submit Claim Request</button>
            </div>
          </form>
        `;

        const btnCancelClaim = document.getElementById('btn-cancel-claim');
        if (btnCancelClaim) {
          btnCancelClaim.addEventListener('click', () => {
            openDetailModal(item._id || item.id);
          });
        }

        const claimForm = document.getElementById('claim-details-form');
        if (claimForm) {
          claimForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btn-submit-claim-form');
            if (btnSubmit) {
              btnSubmit.disabled = true;
              btnSubmit.textContent = 'Submitting...';
            }

            const claimantName = document.getElementById('claim-claimant-name').value.trim();
            const claimantMatric = document.getElementById('claim-claimant-matric').value.trim();
            const claimDetails = document.getElementById('claim-claimant-details').value.trim();

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
                toggleModal('modal-detail', false);
                render();
                showToast(`Verification claim notice submitted to Security successfully.`);
              } else {
                const data = await res.json().catch(() => ({}));
                showToast(data.message || 'Failed to submit claim verification request.', 'error');
                if (btnSubmit) {
                  btnSubmit.disabled = false;
                  btnSubmit.textContent = 'Submit Claim Request';
                }
              }
            } catch (err) {
              showToast('Connection error connecting to backend.', 'error');
              if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Submit Claim Request';
              }
            }
          });
        }
      }
    });
  }
}

// Event Listeners Binding
function setupEventListeners() {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      const newTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
      localStorage.setItem('lcu_findme_theme', newTheme);
    });
  }

  const btnReportHeader = document.getElementById('btn-report-header');
  const btnReportHero = document.getElementById('btn-report-hero');
  const btnCloseReport = document.getElementById('btn-close-report');
  
  const openReportForm = () => {
    document.getElementById('form-report').reset();
    state.tempUploadedImage = null;
    document.getElementById('preview-container').style.display = 'none';
    document.getElementById('upload-zone').style.display = 'block';
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('report-date').value = today;
    
    document.getElementById('report-reporter').value = state.currentUser.name;
    document.getElementById('report-contact').value = state.currentUser.phoneNumber || state.currentUser.phone || '';
    
    toggleModal('modal-report', true);
  };
  
  if (btnReportHeader) btnReportHeader.addEventListener('click', openReportForm);
  if (btnReportHero) btnReportHero.addEventListener('click', openReportForm);
  if (btnCloseReport) btnCloseReport.addEventListener('click', () => toggleModal('modal-report', false));
  
  const btnCloseDetail = document.getElementById('btn-close-detail');
  if (btnCloseDetail) btnCloseDetail.addEventListener('click', () => toggleModal('modal-detail', false));

  const btnCloseQr = document.getElementById('btn-close-qr');
  if (btnCloseQr) btnCloseQr.addEventListener('click', () => toggleModal('modal-qr', false));
  
  document.querySelectorAll('.modal-container').forEach(container => {
    container.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        toggleModal(backdrop.id, false);
      }
    });
  });

  const typeFoundBtn = document.getElementById('type-select-found');
  const typeLostBtn = document.getElementById('type-select-lost');
  let selectedReportType = 'found';
  
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

  // File Upload Logic
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
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        state.tempUploadedImage = compressedBase64;
        
        previewImage.src = compressedBase64;
        uploadZone.style.display = 'none';
        previewContainer.style.display = 'block';

        const categoryVal = document.getElementById('report-category').value;
        if (categoryVal === 'documents') {
          runOcrSimulation(compressedBase64);
        }
      };
      img.src = event.target.value || event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // OCR Simulation
  function runOcrSimulation(base64Data) {
    showToast('🔎 Scanning document with AI OCR Engine...', 'info');
    
    setTimeout(() => {
      const detectedName = "Oluwaseun Alabi";
      const detectedMatric = "LCU/UG/23/10294";
      
      showToast('✨ OCR scan successful. Autopopulating details.', 'success');
      
      const descTextarea = document.getElementById('report-description');
      const titleInput = document.getElementById('report-title');
      
      if (titleInput && titleInput.value.trim() === '') {
        titleInput.value = "Student ID Card - Oluwaseun Alabi";
      }
      
      if (descTextarea) {
        let currentDesc = descTextarea.value;
        if (currentDesc.trim() !== '') currentDesc += "\n\n";
        descTextarea.value = currentDesc + `[AI OCR SCAN DETAILS]\nDetected Owner: ${detectedName}\nMatric No: ${detectedMatric}\nDocument Type: LCU Student ID Card`;
      }
    }, 1500);
  }

  const mapToggleBtn = document.getElementById('btn-toggle-map');
  const mapContainer = document.getElementById('map-container');
  if (mapToggleBtn && mapContainer) {
    mapToggleBtn.addEventListener('click', () => {
      const isHidden = mapContainer.style.display === 'none';
      mapContainer.style.display = isHidden ? 'block' : 'none';
      mapToggleBtn.textContent = isHidden ? "❌ Hide Interactive Map" : "🗺️ Use Interactive Campus Map";
    });
  }

  // Map Landmarks Selector
  const buildings = document.querySelectorAll('.map-building');
  buildings.forEach(building => {
    building.addEventListener('click', () => {
      const landmarkName = building.getAttribute('data-name');
      const locationInput = document.getElementById('report-location');
      if (locationInput) {
        locationInput.value = landmarkName;
        showToast(`Selected "${landmarkName}" on map.`);
        
        buildings.forEach(b => b.querySelector('rect').setAttribute('fill', '#eff6ff'));
        building.querySelector('rect').setAttribute('fill', '#dbeafe');
      }
    });
  });

  // Category selection scroll chips
  const chips = document.querySelectorAll('.category-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filters.category = chip.getAttribute('data-category');
      render();
    });
  });

  // Filter Tabs
  const typeTabs = document.querySelectorAll('.filter-tabs .filter-tab');
  typeTabs.forEach(tab => {
    // Exclude Report Type buttons in the modal
    if (tab.id === 'type-select-found' || tab.id === 'type-select-lost') return;
    tab.addEventListener('click', () => {
      typeTabs.forEach(t => {
        if (t.id !== 'type-select-found' && t.id !== 'type-select-lost') {
          t.classList.remove('active');
        }
      });
      tab.classList.add('active');
      state.filters.type = tab.getAttribute('data-type');
      render();
    });
  });

  // Search input triggers
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
  const navProfile = document.getElementById('nav-profile');
  const sectionTitle = document.getElementById('section-title');

  const switchSectionVisibility = (view) => {
    const listingsSection = document.getElementById('listings-section');
    const profileSection = document.getElementById('profile-section');
    const heroSection = document.querySelector('.hero-section');
    const statsContainer = document.querySelector('.stats-container');

    if (view === 'profile') {
      if (listingsSection) listingsSection.style.display = 'none';
      if (profileSection) profileSection.style.display = 'block';
      if (heroSection) heroSection.style.display = 'none';
      if (statsContainer) statsContainer.style.display = 'none';
    } else {
      if (listingsSection) listingsSection.style.display = 'block';
      if (profileSection) profileSection.style.display = 'none';
      if (heroSection) heroSection.style.display = 'block';
      if (statsContainer) statsContainer.style.display = 'grid';
    }
  };
  
  if (navHome) {
    navHome.addEventListener('click', (e) => {
      e.preventDefault();
      navHome.classList.add('active');
      if (navMyItems) navMyItems.classList.remove('active');
      if (navProfile) navProfile.classList.remove('active');
      state.currentView = 'dashboard';
      if (sectionTitle) sectionTitle.textContent = "Recent Listings";
      switchSectionVisibility('dashboard');
      render();
    });
  }
  
  if (navMyItems) {
    navMyItems.addEventListener('click', (e) => {
      e.preventDefault();
      navMyItems.classList.add('active');
      if (navHome) navHome.classList.remove('active');
      if (navProfile) navProfile.classList.remove('active');
      state.currentView = 'my-items';
      if (sectionTitle) sectionTitle.textContent = "My Reported Listings";
      switchSectionVisibility('my-items');
      render();
    });
  }

  if (navProfile) {
    navProfile.addEventListener('click', (e) => {
      e.preventDefault();
      navProfile.classList.add('active');
      if (navHome) navHome.classList.remove('active');
      if (navMyItems) navMyItems.classList.remove('active');
      state.currentView = 'profile';
      switchSectionVisibility('profile');
      syncLoginUI();
    });
  }

  const btnProfileCardEdit = document.getElementById('btn-profile-card-edit');
  if (btnProfileCardEdit) {
    btnProfileCardEdit.addEventListener('click', () => {
      const editBtn = document.getElementById('btn-edit-profile');
      if (editBtn) editBtn.click();
    });
  }

  const btnScroll = document.getElementById('btn-scroll-dashboard');
  if (btnScroll) {
    btnScroll.addEventListener('click', () => {
      document.getElementById('listings-section').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Logout trigger
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      state.currentUser = null;
      localStorage.removeItem('lcu_findme_token');
      localStorage.removeItem('lcu_findme_user');
      showToast('You have securely logged out.');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
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
        document.getElementById('edit-profile-contact').value = state.currentUser.email || state.currentUser.contact || '';
        document.getElementById('edit-profile-matric').value = state.currentUser.matricNumber || state.currentUser.matric || '';
        document.getElementById('edit-profile-dept').value = state.currentUser.department || state.currentUser.dept || '';
        document.getElementById('edit-profile-phone').value = state.currentUser.phoneNumber || state.currentUser.phone || '';
        
        const avatarPreview = document.getElementById('edit-avatar-preview');
        if (avatarPreview) avatarPreview.textContent = (state.currentUser.name || 'U').charAt(0).toUpperCase();
        
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
        state.currentUser.name = newName;
        state.currentUser.email = newContact;
        state.currentUser.contact = newContact;
        
        const matricVal = document.getElementById('edit-profile-matric').value.trim();
        state.currentUser.matricNumber = matricVal;
        state.currentUser.matric = matricVal;
        
        const deptVal = document.getElementById('edit-profile-dept').value.trim();
        state.currentUser.department = deptVal;
        state.currentUser.dept = deptVal;
        
        const phoneVal = document.getElementById('edit-profile-phone').value.trim();
        state.currentUser.phoneNumber = phoneVal;
        state.currentUser.phone = phoneVal;
        
        localStorage.setItem('lcu_findme_user', JSON.stringify(state.currentUser));

        syncLoginUI();
        toggleModal('modal-edit-profile', false);
        showToast('Profile updated successfully.');
      }
    });
  }

  // OTP Verification
  const btnCloseOtp = document.getElementById('btn-close-otp');
  if (btnCloseOtp) btnCloseOtp.addEventListener('click', () => toggleModal('modal-otp', false));

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
        const cleanVal = e.target.value.replace(/\D/g, '');
        e.target.value = cleanVal;

        if (cleanVal.length > 1) {
          e.target.value = cleanVal.slice(-1);
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
        } else if (e.key === 'ArrowLeft' && index > 0) {
          otpInputs[index - 1].focus();
          e.preventDefault();
        } else if (e.key === 'ArrowRight' && index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
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
        if (errorMsg) { errorMsg.textContent = 'Session expired. Please try again.'; errorMsg.style.display = 'block'; }
        return;
      }

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
          state.currentUser = data.user;
          localStorage.setItem('lcu_findme_token', data.token);
          localStorage.setItem('lcu_findme_user', JSON.stringify(data.user));
          syncLoginUI();
          showToast('Email verified successfully!');
          state.pendingVerifEmail = null;
        } else {
          if (errorMsg) { errorMsg.textContent = data.message || 'Invalid verification code.'; errorMsg.style.display = 'block'; }
        }
      } catch (err) {
        if (errorMsg) { errorMsg.textContent = 'Connection error. Please try again.'; errorMsg.style.display = 'block'; }
      } finally {
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.innerHTML = 'Verify Account';
        }
      }
    });
  }

  const btnResendOtp = document.getElementById('btn-resend-otp');
  if (btnResendOtp) {
    btnResendOtp.addEventListener('click', async () => {
      const email = state.pendingVerifEmail;
      if (!email) {
        showToast('Session expired. Please try again.', 'error');
        return;
      }

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
        await fetch(`${API_URL}/auth/resend-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        showToast('A new verification code has been sent to your email.');
      } catch (err) {
        showToast('Failed to resend code. Please try again.', 'error');
      }
    });
  }

  // Report Form Submit
  const formReport = document.getElementById('form-report');
  if (formReport) {
    formReport.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('btn-submit-report');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      const reportData = {
        title: document.getElementById('report-title').value.trim(),
        category: document.getElementById('report-category').value,
        location: document.getElementById('report-location').value.trim(),
        date: document.getElementById('report-date').value,
        reporterName: document.getElementById('report-reporter').value.trim(),
        reporterContact: document.getElementById('report-contact').value.trim(),
        description: document.getElementById('report-description').value.trim(),
        type: selectedReportType,
        image: state.tempUploadedImage
      };

      try {
        const token = localStorage.getItem('lcu_findme_token');
        const res = await fetch(`${API_URL}/items`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(reportData)
        });
        const data = await res.json();

        if (res.ok) {
          toggleModal('modal-report', false);
          showToast(`Report logged successfully as ${selectedReportType.toUpperCase()}.`);
          
          const potentialMatch = findPotentialMatches(data);
          if (potentialMatch) {
            state.pendingMatchItem = potentialMatch;
            document.getElementById('match-results-container').innerHTML = `
              <div class="item-card" style="margin-top:0.5rem; width: 100%;">
                <div class="card-content">
                  <div class="card-meta">
                    <span>${formatDate(potentialMatch.date)}</span>
                    <span class="meta-dot"></span>
                    <span style="text-transform: capitalize;">${potentialMatch.category}</span>
                  </div>
                  <h3 class="card-title">${potentialMatch.title}</h3>
                  <p class="card-description">${potentialMatch.description}</p>
                  <div style="font-size:0.8rem; margin-top:0.5rem; color:var(--primary); font-weight:600;">
                    📍 Location: ${potentialMatch.location}
                  </div>
                </div>
              </div>
            `;
            setTimeout(() => {
              toggleModal('modal-match', true);
            }, 800);
          } else {
            render();
          }
        } else {
          showToast(data.message || 'Failed to submit report.', 'error');
        }
      } catch (err) {
        showToast('Connection error connecting to backend.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Report';
        }
      }
    });
  }

  // Match Modal controls
  const btnCloseMatch = document.getElementById('btn-close-match');
  if (btnCloseMatch) btnCloseMatch.addEventListener('click', () => toggleModal('modal-match', false));

  const btnMatchIgnore = document.getElementById('btn-match-ignore');
  if (btnMatchIgnore) {
    btnMatchIgnore.addEventListener('click', () => {
      toggleModal('modal-match', false);
      state.pendingMatchItem = null;
      render();
    });
  }

  const btnMatchView = document.getElementById('btn-match-view');
  if (btnMatchView) {
    btnMatchView.addEventListener('click', () => {
      const matchItem = state.pendingMatchItem;
      toggleModal('modal-match', false);
      state.pendingMatchItem = null;
      if (matchItem) {
        openDetailModal(matchItem._id || matchItem.id);
      }
      render();
    });
  }

  // Print QR label inside QR modal
  const btnPrintQR = document.getElementById('btn-print-qr');
  if (btnPrintQR) {
    btnPrintQR.addEventListener('click', () => {
      const labelHTML = document.getElementById('print-label-area').outerHTML;
      const printWindow = window.open('', '_blank');
      
      // Grab base64 image from canvas to make sure it loads cleanly in print window
      const qrCanvas = document.getElementById('qr-canvas');
      const qrImageBase64 = qrCanvas.toDataURL('image/png');
      
      // Construct exact print preview styling for the physical label sticker
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Secure Bin Tag Label</title>
            <style>
              body { font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 90vh; margin:0; }
              #print-label-area { border: 2px solid #0f172a; padding: 1.5rem; border-radius: 8px; color: #0f172a; width: 380px; }
              h2 { font-size: 1.25rem; border-bottom: 2px solid #0f172a; padding-bottom: 0.5rem; margin-top: 0; margin-bottom: 0.75rem; display: flex; justify-content: space-between; }
              #qr-print-image { border: 1px solid #e2e8f0; width: 120px; height: 120px; border-radius: 4px; }
              strong { color: #0f172a; }
            </style>
          </head>
          <body>
            <div id="print-label-area">
              <h2>
                <span>LCU FindMe</span>
                <span style="font-size: 0.85rem; font-weight: normal; align-self: center;">SECURE LABEL</span>
              </h2>
              <div style="display: flex; gap: 1.5rem; align-items: center;">
                <img id="qr-print-image" src="${qrImageBase64}" />
                <div style="font-size: 0.82rem; line-height: 1.6; display: flex; flex-direction: column; gap: 0.4rem; padding-left: 0.5rem;">
                  <div style="font-weight: bold; font-size: 0.95rem;" id="qr-label-title">${document.getElementById('qr-label-title').textContent}</div>
                  <div>ID: <span style="font-family: monospace; font-weight: 700;">${document.getElementById('qr-label-id').textContent}</span></div>
                  <div>Category: <span style="text-transform: capitalize;">${document.getElementById('qr-label-category').textContent}</span></div>
                  <div>Location: <span>${document.getElementById('qr-label-location').textContent}</span></div>
                  <div style="margin-top: 0.5rem; font-weight: bold; border: 1px dashed #0f172a; padding: 0.3rem 0.5rem; text-align: center; text-transform: uppercase; border-radius: 4px;">
                    🔒 Bin Tag Required
                  </div>
                </div>
              </div>
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    });
  }
}

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================
const notifications = JSON.parse(localStorage.getItem('lcu_findme_notifs') || '[]');

async function fetchNotifications() {
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
      let hasNew = false;
      dbNotifs.forEach(dbN => {
        const exists = notifications.some(n => n.message === dbN.message);
        if (!exists) {
          notifications.unshift({
            message: dbN.message,
            time: dbN.time || new Date().toISOString(),
            read: false
          });
          hasNew = true;
        }
      });
      if (notifications.length > 20) notifications.length = 20;
      if (hasNew) {
        saveNotifs();
        renderNotifications();
      }
    }
  } catch (error) {
    console.error('Error fetching notifications:', error);
  }
}

// Poll for notifications every 15 seconds
setInterval(fetchNotifications, 15000);

function saveNotifs() {
  localStorage.setItem('lcu_findme_notifs', JSON.stringify(notifications));
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

// Initial notifications render
renderNotifications();

async function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get('item');
  if (!itemId) return;

  const btnCloseSlip = document.getElementById('btn-close-slip');
  const btnDismissSlip = document.getElementById('btn-dismiss-slip');
  if (btnCloseSlip) btnCloseSlip.addEventListener('click', () => toggleModal('modal-verify-slip', false));
  if (btnDismissSlip) btnDismissSlip.addEventListener('click', () => toggleModal('modal-verify-slip', false));
  
  const btnPrintSlip = document.getElementById('btn-print-slip');
  if (btnPrintSlip) {
    btnPrintSlip.addEventListener('click', () => {
      const slipContent = document.querySelector('.security-slip').outerHTML;
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>LCU FindMe Security Slip</title>
            <style>
              body { font-family: 'Inter', sans-serif; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
              .security-slip { border: 2px dashed #64748b; border-radius: 12px; padding: 24px; background: #f8fafc; width: 400px; }
              strong { color: #0f172a; }
              span { color: #64748b; }
              .status-badge { display: inline-flex; padding: 0.25rem 0.65rem; border-radius: 50px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
              .status-active { background-color: #fffbeb; color: #f59e0b; }
              .status-returned { background-color: #ecfdf5; color: #10b981; }
            </style>
          </head>
          <body>
            ${slipContent}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    });
  }

  try {
    showToast('Loading verified security slip details...', 'info');
    
    const res = await fetch(`${API_URL}/items/${itemId}`);
    if (!res.ok) {
      showToast('Could not retrieve item verification details.', 'error');
      return;
    }
    const item = await res.json();
    
    document.getElementById('slip-ref').textContent = `REF-${item._id ? item._id.substring(item._id.length - 8).toUpperCase() : 'UNKNOWN'}`;
    
    const statusEl = document.getElementById('slip-status');
    if (statusEl) {
      statusEl.textContent = (item.status || 'FOUND').toUpperCase();
      statusEl.className = `status-badge ${item.status === 'returned' ? 'status-returned' : 'status-active'}`;
    }
    
    document.getElementById('slip-title').textContent = item.title;
    document.getElementById('slip-category').textContent = item.category;
    document.getElementById('slip-location').textContent = item.location;
    document.getElementById('slip-date').textContent = formatDate(item.date);
    
    const isFound = item.type === 'found';
    const repTitleEl = document.getElementById('modal-slip-reporter-title');
    if (repTitleEl) repTitleEl.textContent = isFound ? 'Founder Credentials' : 'Reporter Credentials';
    
    let reporterHtml = `
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--text-muted);">Name:</span>
        <strong style="color: var(--text-dark);">${item.reporterName || 'Anonymous'}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--text-muted);">Contact Details:</span>
        <strong style="color: var(--text-dark);">${item.reporterContact || 'Not Provided'}</strong>
      </div>
    `;
    if (item.reporterEmail) {
      reporterHtml += `
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Email:</span>
          <strong style="color: var(--text-dark);">${item.reporterEmail}</strong>
        </div>
      `;
    }
    if (item.reporterMatric) {
      reporterHtml += `
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Matric / Staff ID:</span>
          <strong style="color: var(--text-dark); font-family: monospace;">${item.reporterMatric}</strong>
        </div>
      `;
    }
    if (item.reporterFaculty) {
      reporterHtml += `
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Faculty:</span>
          <strong style="color: var(--text-dark);">${item.reporterFaculty}</strong>
        </div>
      `;
    }
    if (item.reporterDept) {
      reporterHtml += `
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Department:</span>
          <strong style="color: var(--text-dark);">${item.reporterDept}</strong>
        </div>
      `;
    }
    if (item.reporterLevel) {
      reporterHtml += `
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Level:</span>
          <strong style="color: var(--text-dark);">${item.reporterLevel} Level</strong>
        </div>
      `;
    }
    const repListEl = document.getElementById('modal-slip-reporter-list');
    if (repListEl) repListEl.innerHTML = reporterHtml;

    const acceptedClaim = item.verificationClaims && item.verificationClaims.find(c => c.status === 'accepted' || c.resolved);
    const claimBoxEl = document.getElementById('modal-slip-claimant-box');
    const claimListEl = document.getElementById('modal-slip-claimant-list');
    
    if (acceptedClaim) {
      let claimantHtml = `
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Claimer Name:</span>
          <strong style="color: var(--text-dark);">${acceptedClaim.claimantName}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Matric / Staff ID:</span>
          <strong style="color: var(--text-dark); font-family: monospace;">${acceptedClaim.claimantMatric}</strong>
        </div>
      `;
      if (acceptedClaim.claimantPhone) {
        claimantHtml += `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Phone:</span>
            <strong style="color: var(--text-dark);">${acceptedClaim.claimantPhone}</strong>
          </div>
        `;
      }
      if (acceptedClaim.claimantEmail) {
        claimantHtml += `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Email:</span>
            <strong style="color: var(--text-dark);">${acceptedClaim.claimantEmail}</strong>
          </div>
        `;
      }
      if (acceptedClaim.claimantFaculty) {
        claimantHtml += `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Faculty:</span>
            <strong style="color: var(--text-dark);">${acceptedClaim.claimantFaculty}</strong>
          </div>
        `;
      }
      if (acceptedClaim.claimantDept) {
        claimantHtml += `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Department:</span>
            <strong style="color: var(--text-dark);">${acceptedClaim.claimantDept}</strong>
          </div>
        `;
      }
      if (acceptedClaim.claimantLevel) {
        claimantHtml += `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Level:</span>
            <strong style="color: var(--text-dark);">${acceptedClaim.claimantLevel} Level</strong>
          </div>
        `;
      }
      if (claimListEl) claimListEl.innerHTML = claimantHtml;
      if (claimBoxEl) claimBoxEl.style.display = 'block';
    } else {
      if (claimBoxEl) claimBoxEl.style.display = 'none';
    }
    
    toggleModal('modal-verify-slip', true);
  } catch (err) {
    showToast('Connection error loading security slip.', 'error');
  }
}
