/* ──────────────────────────────────────────── */
/* HabitFlow - Settings Scripting               */
/* ──────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  const username = Auth.getCurrentUser();
  if (!username) {
    Auth.checkAuth(true);
    return;
  }

  // Load theme and layout
  ThemeManager.load(username);
  UILayout.inject(username);

  // States
  let userData = LocalDB.getUserData(username);

  // DOM Elements
  const usernameDisplay = document.getElementById('settings-username-display');
  const btnThemeDark = document.getElementById('btn-theme-dark');
  const btnThemeLight = document.getElementById('btn-theme-light');
  
  const accentEmerald = document.getElementById('accent-scheme-emerald');
  const accentBlue = document.getElementById('accent-scheme-blue');
  const accentViolet = document.getElementById('accent-scheme-violet');
  const accentRose = document.getElementById('accent-scheme-rose');
  const accentAmber = document.getElementById('accent-scheme-amber');

  const fileInput = document.getElementById('backup-file-input');

  // Set username text
  usernameDisplay.value = username;

  // Active theme / accent indicator stylers
  function updateIndicators() {
    const { theme, colorScheme } = userData.settings || { theme: 'dark', colorScheme: 'emerald' };

    // 1. Theme borders styling
    const activeThemeClass = 'border-accent text-accent ring-1 ring-accent/30 bg-accent/5';
    const inactiveThemeClass = 'border-card-border text-foreground/70 bg-background';

    if (theme === 'dark') {
      btnThemeDark.className = `${btnThemeDark.className.replace(/border-.*$/, '')} ${activeThemeClass}`;
      btnThemeLight.className = `${btnThemeLight.className.replace(/border-.*$/, '')} ${inactiveThemeClass}`;
    } else {
      btnThemeDark.className = `${btnThemeDark.className.replace(/border-.*$/, '')} ${inactiveThemeClass}`;
      btnThemeLight.className = `${btnThemeLight.className.replace(/border-.*$/, '')} ${activeThemeClass}`;
    }

    // 2. Accent circle selectors styling
    const circles = [
      { el: accentEmerald, key: 'emerald' },
      { el: accentBlue, key: 'blue' },
      { el: accentViolet, key: 'violet' },
      { el: accentRose, key: 'rose' },
      { el: accentAmber, key: 'amber' }
    ];

    circles.forEach(circle => {
      if (circle.key === colorScheme) {
        circle.el.className = circle.el.className.replace(/border-.*$/, 'border-white dark:border-zinc-300 ring-2 ring-accent scale-110');
      } else {
        circle.el.className = circle.el.className.replace(/border-.*$/, 'border-transparent');
      }
    });
  }

  // Theme click event bindings
  btnThemeDark.addEventListener('click', () => {
    ThemeManager.save(username, { theme: 'dark' });
    userData = LocalDB.getUserData(username);
    updateIndicators();
    UILayout.inject(username); // Re-inject sidebar to apply theme changes
  });

  btnThemeLight.addEventListener('click', () => {
    ThemeManager.save(username, { theme: 'light' });
    userData = LocalDB.getUserData(username);
    updateIndicators();
    UILayout.inject(username); // Re-inject sidebar to apply theme changes
  });

  // Color Accent clicks event bindings
  const bindAccentClick = (btnEl, schemeKey) => {
    btnEl.addEventListener('click', () => {
      ThemeManager.save(username, { colorScheme: schemeKey });
      userData = LocalDB.getUserData(username);
      updateIndicators();
      UILayout.inject(username); // Re-inject sidebar to apply accent changes
    });
  };

  bindAccentClick(accentEmerald, 'emerald');
  bindAccentClick(accentBlue, 'blue');
  bindAccentClick(accentViolet, 'violet');
  bindAccentClick(accentRose, 'rose');
  bindAccentClick(accentAmber, 'amber');

  // 3. Export Data Backup Trigger
  document.getElementById('btn-backup-export').addEventListener('click', () => {
    // Generate clean backup payload (excluding password hash for safety)
    const backupData = { ...userData };
    delete backupData.passwordHash;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const dateStr = new Date().toISOString().substring(0, 10);
    const link = document.createElement('a');
    
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `habitflow_backup_${username}_${dateStr}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // 4. Import Data Backup Trigger
  document.getElementById('btn-backup-import').addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const importedData = JSON.parse(evt.target.result);
        
        // Basic integrity checks
        if (!importedData.categories || !importedData.habits || !importedData.logs) {
          throw new Error('Invalid backup file format');
        }

        const locale = LocaleManager.get();
        const confirmMsg = TRANSLATIONS[locale].settings.confirmImport;
        const successMsg = TRANSLATIONS[locale].settings.importSuccess;

        if (confirm(confirmMsg)) {
          // Restore password hash from current database to avoid locking out the user
          importedData.passwordHash = userData.passwordHash;
          
          LocalDB.saveUserData(username, importedData);
          alert(successMsg);
          window.location.reload();
        }
      } catch (err) {
        alert('Error parsing JSON backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Translate page dynamically on local switches
  window.addEventListener('localeChanged', () => {
    LocaleManager.translateDOM();
    UILayout.inject(username);
  });

  // Initial runs
  updateIndicators();
  LocaleManager.translateDOM();
});
