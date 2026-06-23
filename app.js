const API_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:'
  ? 'http://127.0.0.1:5000/api'
  : 'https://leadcitylostnfound.onrender.com/api';

// State Object
let state = {
  items: [],
  currentUser: null,
  pendingVerifEmail: null
};

// Check if user is logged in on load
function checkRedirect() {
  const token = localStorage.getItem('lcu_findme_token');
  const savedUser = localStorage.getItem('lcu_findme_user');
  if (token && savedUser) {
    const user = JSON.parse(savedUser);
    if (user.role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'dashboard.html';
    }
    return true;
  }
  return false;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  if (checkRedirect()) return;
  
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

// Fetch stats and items counts from backend
async function fetchItems() {
  try {
    const res = await fetch(`${API_URL}/items?type=all&category=all`);
    const data = await res.json();
    state.items = data;
  } catch (error) {
    console.error('Error fetching items:', error);
  }
}

// Load data on start
async function initData() {
  await fetchItems();
  updateStats();
  renderItems();
}

// Update Stats counters on Landing Page
function updateStats() {
  // Stats can be calculated even if not logged in on the landing page for demonstration
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

// Render Listings Grid - displays login requirement card
function renderItems() {
  const grid = document.getElementById('items-grid');
  if (!grid) return;
  
  grid.innerHTML = `
    <div class="empty-state" style="padding: 4rem 2rem; border: 1px dashed var(--border-color); border-radius: var(--radius-lg); background: var(--bg-secondary); margin-top: 1rem; width: 100%;">
      <div style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
      <h3 style="font-size: 1.25rem; font-family: 'Outfit', sans-serif; color: var(--secondary); margin-bottom: 0.5rem;">Access Restricted</h3>
      <p class="empty-desc" style="max-width: 380px; margin: 0.5rem auto 1.5rem auto; color: var(--text-muted); font-size: 0.95rem; font-weight: 500;">
        Please log in or create an account to view lost and found listings.
      </p>
      <div style="display: flex; gap: 1rem; justify-content: center;">
        <button class="btn btn-primary" id="btn-login-lock" style="padding: 0.6rem 1.5rem;">Log In</button>
        <button class="btn btn-secondary" id="btn-signup-lock" style="padding: 0.6rem 1.5rem;">Create Account</button>
      </div>
    </div>
  `;
  
  const loginLockBtn = document.getElementById('btn-login-lock');
  const signupLockBtn = document.getElementById('btn-signup-lock');
  if (loginLockBtn) {
    loginLockBtn.addEventListener('click', () => {
      const headerLogin = document.getElementById('btn-header-login');
      if (headerLogin) headerLogin.click();
    });
  }
  if (signupLockBtn) {
    signupLockBtn.addEventListener('click', () => {
      const headerSignup = document.getElementById('btn-header-signup');
      if (headerSignup) headerSignup.click();
    });
  }
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

  // Header and Hero elements triggers login
  const btnReportHeader = document.getElementById('btn-report-header');
  const btnReportHero = document.getElementById('btn-report-hero');
  const btnScrollDashboard = document.getElementById('btn-scroll-dashboard');
  
  const triggerLoginPrompt = () => {
    showToast('Please log in or create an account to proceed.', 'warning');
    openAuthModal('login');
  };
  
  if (btnReportHeader) btnReportHeader.addEventListener('click', triggerLoginPrompt);
  if (btnReportHero) btnReportHero.addEventListener('click', triggerLoginPrompt);
  if (btnScrollDashboard) {
    btnScrollDashboard.addEventListener('click', () => {
      document.getElementById('listings-section').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Backdrop click modal close
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
    } else {
      showToast('Successfully logged in. Opening your dashboard...');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
    }
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
        } else if (res.status === 403 && data.requiresVerification) {
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
  const emailLabel = document.getElementById('signup-email-label');
  const matricInput = document.getElementById('signup-matric');
  const levelSelect = document.getElementById('signup-level');
  const facultySelect = document.getElementById('signup-faculty');
  const deptInput = document.getElementById('signup-dept');
  
  if (signupRole) {
    signupRole.addEventListener('change', () => {
      const isStudent = signupRole.value === 'student';
      if (isStudent) {
        if (studentFields) studentFields.style.display = 'block';
        if (emailLabel) emailLabel.textContent = "University Email *";
        if (matricInput) matricInput.required = true;
        if (levelSelect) levelSelect.required = true;
        if (facultySelect) facultySelect.required = true;
        if (deptInput) deptInput.required = true;
        document.getElementById('btn-submit-signup').textContent = "Create Student Account";
      } else {
        if (studentFields) studentFields.style.display = 'none';
        if (emailLabel) emailLabel.textContent = "Staff Email Address *";
        if (matricInput) matricInput.required = false;
        if (levelSelect) levelSelect.required = false;
        if (facultySelect) facultySelect.required = false;
        if (deptInput) deptInput.required = false;
        document.getElementById('btn-submit-signup').textContent = "Create Staff Account";
      }
    });
  }

  if (formSignup) {
    formSignup.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const password = document.getElementById('signup-password').value;
      const confirm = document.getElementById('signup-confirm').value;
      
      if (password !== confirm) {
        showToast('Passwords do not match.', 'error');
        return;
      }
      
      const roleVal = signupRole ? signupRole.value : 'student';
      const nameVal = document.getElementById('signup-name').value.trim();
      const emailVal = document.getElementById('signup-email').value.trim();
      const phoneVal = document.getElementById('signup-phone').value.trim();
      
      let payload = {
        role: roleVal,
        name: nameVal,
        email: emailVal,
        phoneNumber: phoneVal,
        password: password
      };
      
      if (roleVal === 'student') {
        payload.matricNumber = document.getElementById('signup-matric').value.toUpperCase().trim();
        payload.level = document.getElementById('signup-level').value;
        payload.faculty = document.getElementById('signup-faculty').value;
        payload.department = document.getElementById('signup-dept').value.trim();
      }

      const signupBtn = document.getElementById('btn-submit-signup');
      if (signupBtn) {
        signupBtn.disabled = true;
        signupBtn.textContent = 'Creating Account...';
      }

      try {
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (res.ok) {
          state.pendingVerifEmail = emailVal;
          toggleModal('modal-auth', false);
          
          const otpDisplay = document.getElementById('otp-email-display');
          if (otpDisplay) otpDisplay.textContent = emailVal;
          toggleModal('modal-otp', true);
          showToast('Account verification required. Check your email for OTP!');
        } else {
          showToast(data.message || 'Account registration failed.', 'error');
        }
      } catch (err) {
        showToast('Connection error connecting to backend.', 'error');
      } finally {
        if (signupBtn) {
          signupBtn.disabled = false;
          signupBtn.textContent = roleVal === 'student' ? 'Create Student Account' : 'Create Staff Account';
        }
      }
    });
  }

  // OTP Verification Submit
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
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.innerHTML = 'Verify Account';
        }
      }
    });
  }

  // Resend OTP
  const btnResendOtp = document.getElementById('btn-resend-otp');
  if (btnResendOtp) {
    btnResendOtp.addEventListener('click', async () => {
      const email = state.pendingVerifEmail;
      if (!email) {
        showToast('Session expired. Please register again.', 'error');
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

  // Forgot Password Trigger Links
  const linkForgot = document.getElementById('link-forgot-password');
  if (linkForgot) {
    linkForgot.addEventListener('click', (e) => {
      e.preventDefault();
      toggleModal('modal-auth', false);
      toggleModal('modal-forgot-password', true);
    });
  }

  const btnCloseForgot = document.getElementById('btn-close-forgot');
  if (btnCloseForgot) btnCloseForgot.addEventListener('click', () => toggleModal('modal-forgot-password', false));

  const btnCloseReset = document.getElementById('btn-close-reset');
  if (btnCloseReset) btnCloseReset.addEventListener('click', () => toggleModal('modal-reset-password', false));

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

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  const mainNav = document.getElementById('main-nav');
  const hamburgerBtn = document.getElementById('hamburger-btn');
  if (mainNav && mainNav.classList.contains('open') && !mainNav.contains(e.target) && e.target !== hamburgerBtn) {
    mainNav.classList.remove('open');
    hamburgerBtn.classList.remove('open');
  }
});

async function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('login') === 'required') {
    showToast('Please log in to access your dashboard.', 'warning');
    openAuthModal('login');
  }
}
