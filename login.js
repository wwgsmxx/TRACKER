/* ──────────────────────────────────────────── */
/* HabitFlow - Login & Register Scripting       */
/* ──────────────────────────────────────────── */

// Expose switchTab to global window scope for inline onclick handlers
window.switchTab = null;

document.addEventListener('DOMContentLoaded', () => {
  // Check auth first (redirect if logged in)
  if (!Auth.checkAuth(false)) return;

  // Initialize copyright year
  document.getElementById('current-year').textContent = new Date().getFullYear();

  // Tab switching state control
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const errorBox = document.getElementById('error-box');
  const errorMessage = document.getElementById('error-message');

  const switchTab = (tab) => {
    // Hide error box
    errorBox.classList.add('hidden');

    if (tab === 'register') {
      tabLogin.classList.add('hidden');
      tabRegister.classList.remove('hidden');
      // Update URL query parameter
      window.history.replaceState({}, '', '?tab=register');
    } else {
      tabRegister.classList.add('hidden');
      tabLogin.classList.remove('hidden');
      // Update URL query parameter
      window.history.replaceState({}, '', '?tab=login');
    }
  };
  window.switchTab = switchTab; // Expose globally

  // Check URL params on load
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  if (tabParam === 'register') {
    switchTab('register');
  } else {
    switchTab('login');
  }

  // Error messaging helper
  const showError = (errKey) => {
    const locale = LocaleManager.get();
    const errorsDict = TRANSLATIONS[locale].auth.errors;
    const msg = errorsDict[errKey] || errKey;
    errorMessage.textContent = msg;
    errorBox.classList.remove('hidden');
  };

  // Success screen redirection helper
  const showSuccessAndRedirect = (titleKey, subtitleKey) => {
    const locale = LocaleManager.get();
    const successTitle = TRANSLATIONS[locale].auth[titleKey].successTitle;
    const successSubtitle = TRANSLATIONS[locale].auth[titleKey].successSubtitle;

    document.getElementById('success-title').textContent = successTitle;
    document.getElementById('success-subtitle').textContent = successSubtitle;
    
    const successOverlay = document.getElementById('success-overlay');
    successOverlay.classList.remove('hidden');

    setTimeout(() => {
      window.location.href = './dashboard.html';
    }, 1500);
  };

  // Form Submissions
  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');

    const usernameInput = document.getElementById('login-username').value;
    const passwordInput = document.getElementById('login-password').value;

    try {
      await Auth.login(usernameInput, passwordInput);
      showSuccessAndRedirect('login');
    } catch (err) {
      showError(err.message);
    }
  });

  const registerForm = document.getElementById('register-form');
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');

    const usernameInput = document.getElementById('register-username').value;
    const passwordInput = document.getElementById('register-password').value;
    const confirmPasswordInput = document.getElementById('register-confirm-password').value;

    if (passwordInput !== confirmPasswordInput) {
      showError('passwordMismatch');
      return;
    }

    try {
      await Auth.register(usernameInput, passwordInput);
      showSuccessAndRedirect('register');
    } catch (err) {
      showError(err.message);
    }
  });

  // Localized view compilation
  function translatePage() {
    LocaleManager.translateDOM();

    const locale = LocaleManager.get();
    const enBtn = document.getElementById('lang-en');
    const kkBtn = document.getElementById('lang-kk');

    const activeClass = 'bg-accent text-white shadow-xs';
    const inactiveClass = 'text-zinc-400 hover:text-white';

    if (locale === 'en') {
      enBtn.className = `px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${activeClass}`;
      kkBtn.className = `px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${inactiveClass}`;
    } else {
      enBtn.className = `px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${inactiveClass}`;
      kkBtn.className = `px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${activeClass}`;
    }
  }

  // Listen to language changes
  window.addEventListener('localeChanged', translatePage);

  // Trigger translation on load
  translatePage();
});
