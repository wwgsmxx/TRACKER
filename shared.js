/* ──────────────────────────────────────────── */
/* HabitFlow - Shared JS (Database, Auth, UI)   */
/* ──────────────────────────────────────────── */

// ─── Constants & Colors ──────────────────────────────────────────────
const COLOR_SCHEMES = {
  emerald: { accent: '#10b981', hover: '#059669', muted: 'rgba(16, 185, 129, 0.08)' },
  blue: { accent: '#3b82f6', hover: '#2563eb', muted: 'rgba(59, 130, 246, 0.08)' },
  violet: { accent: '#8b5cf6', hover: '#7c3aed', muted: 'rgba(139, 92, 246, 0.08)' },
  rose: { accent: '#f43f5e', hover: '#e11d48', muted: 'rgba(244, 63, 94, 0.08)' },
  amber: { accent: '#f59e0b', hover: '#d97706', muted: 'rgba(245, 158, 11, 0.08)' }
};

const DEFAULT_SETTINGS = {
  theme: 'dark',
  colorScheme: 'emerald'
};

// ─── LocalStorage Database Client ───────────────────────────────────
class LocalDB {
  static getDB() {
    let data = localStorage.getItem('habitflow_db');
    if (!data) {
      data = { users: {} };
      localStorage.setItem('habitflow_db', JSON.stringify(data));
      return data;
    }
    return JSON.parse(data);
  }

  static saveDB(db) {
    localStorage.setItem('habitflow_db', JSON.stringify(db));
  }

  static getUserData(username) {
    const db = this.getDB();
    if (!db.users[username]) {
      db.users[username] = {
        passwordHash: '',
        settings: { ...DEFAULT_SETTINGS },
        categories: [
          { id: 'cat-health', name: 'Health & Fitness 🏋️', order: 0, habits: [] },
          { id: 'cat-mind', name: 'Mind & Learning 📚', order: 1, habits: [] }
        ],
        habits: [
          { id: 'h-water', categoryId: 'cat-health', name: 'Drink Water 💧', order: 0, isPinned: true, isArchived: false },
          { id: 'h-exercise', categoryId: 'cat-health', name: 'Exercise 🏃', order: 1, isPinned: false, isArchived: false },
          { id: 'h-reading', categoryId: 'cat-mind', name: 'Read Book 📖', order: 0, isPinned: true, isArchived: false }
        ],
        logs: [],
        notes: {}, // { "YYYY-MM-DD": "Note content..." }
        monthlyGoals: [], // [ { id, month: "YYYY-MM", content, completed } ]
        yearlyGoals: [] // [ { id, year: YYYY, content, completed } ]
      };
      this.saveDB(db);
    }
    return db.users[username];
  }

  static saveUserData(username, userData) {
    const db = this.getDB();
    db.users[username] = userData;
    this.saveDB(db);
  }
}

// ─── Simple Client Cryptography Helper ─────────────────────────────
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Auth System Module ─────────────────────────────────────────────
const Auth = {
  async register(username, password) {
    const trimmed = username.trim();
    if (trimmed.length < 3) throw new Error('usernameTooShort');
    if (password.length < 6) throw new Error('passwordTooShort');

    const db = LocalDB.getDB();
    if (db.users[trimmed]) throw new Error('usernameTaken');

    const passwordHash = await hashPassword(password);
    const userData = LocalDB.getUserData(trimmed);
    userData.passwordHash = passwordHash;
    LocalDB.saveUserData(trimmed, userData);

    this.setSession(trimmed);
    return trimmed;
  },

  async login(username, password) {
    const trimmed = username.trim();
    if (!trimmed || !password) throw new Error('fillAll');

    const db = LocalDB.getDB();
    if (!db.users[trimmed]) throw new Error('invalidCredentials');

    const passwordHash = await hashPassword(password);
    if (db.users[trimmed].passwordHash !== passwordHash) {
      throw new Error('invalidCredentials');
    }

    this.setSession(trimmed);
    return trimmed;
  },

  logout() {
    localStorage.removeItem('habitflow_session');
    window.location.href = './login.html';
  },

  setSession(username) {
    localStorage.setItem('habitflow_session', JSON.stringify({ username, loginTime: Date.now() }));
  },

  getCurrentUser() {
    const sessionStr = localStorage.getItem('habitflow_session');
    if (!sessionStr) return null;
    try {
      const session = JSON.parse(sessionStr);
      // Validate that user still exists in database
      const db = LocalDB.getDB();
      if (db.users[session.username]) {
        return session.username;
      }
    } catch (e) {
      return null;
    }
    return null;
  },

  checkAuth(isProtectedRoute) {
    const user = this.getCurrentUser();
    const currentFile = window.location.pathname.split('/').pop();

    if (isProtectedRoute && !user) {
      window.location.href = './login.html';
      return false;
    }
    if ((currentFile === 'login.html' || currentFile === 'landing.html') && user) {
      window.location.href = './dashboard.html';
      return false;
    }
    return true;
  }
};

// ─── Translations Dictionary ────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    nav: {
      dashboard: 'Dashboard',
      tracker: 'Tracker',
      statistics: 'Statistics',
      calendar: 'Calendar',
      settings: 'Settings',
      syncStatus: 'Sync Status',
      syncing: 'Syncing...',
      saved: 'Saved',
      loggedInAs: 'Logged in as',
      logout: 'Logout',
    },
    dashboard: {
      welcome: 'Welcome back',
      subtitle: 'Here is your progress and goals for today.',
      todayProgress: "Today's Progress",
      habits: 'habits',
      completed: 'completed',
      currentStreak: 'Current Streak',
      bestStreak: 'Best Streak',
      days: 'days',
      keepItGoing: 'Keep it going!',
      absoluteRecord: 'Your absolute record',
      totalCheckmarks: 'Total Checkmarks',
      monthlyGoals: 'Monthly Goals',
      yearlyGoals: 'Yearly Goals',
      noMonthlyGoals: 'No monthly goals set yet.',
      noYearlyGoals: 'No yearly goals set yet.',
      addMonthlyGoal: 'Add monthly goal...',
      addYearlyGoal: 'Add yearly goal...',
    },
    tracker: {
      title: 'Habits Tracker',
      subtitle: 'Check off completed habits daily. Changes save automatically.',
      searchPlaceholder: 'Search habits...',
      habitsAndProgress: 'Habits & Progress',
      addHabit: 'Add habit...',
      addCategory: 'Add new category...',
      confirmDeleteCategory: 'Are you sure you want to delete this category and all its habits?',
      confirmDeleteHabit: 'Are you sure you want to delete this habit?',
      loading: 'Loading tracker grid...',
      unpin: 'Unpin habit',
      pin: 'Pin habit',
      renameCategory: 'Rename Category',
      deleteCategory: 'Delete Category',
      emptyCategoryHint: 'No habits in this category yet. Add a habit above or use quick presets:',
    },
    calendar: {
      title: 'Calendar & Notes',
      subtitle: 'Select a day to view habit completions and write daily notes.',
      dailyNotes: 'Daily Notes for',
      notesPlaceholder: 'Write your thoughts, reflections or journal entries for this day...',
      saved: 'Saved',
      noHabitsLogged: 'No habits completed on this day.',
      completedHabits: 'Completed Habits',
    },
    statistics: {
      title: 'Analytics & Statistics',
      subtitle: 'Track your performance trends and consistency over time.',
      completionRate: 'Completion Rate',
      activeHabits: 'Active Habits',
      totalLogs: 'Total Checkmarks',
      categoryBreakdown: 'Habits by Category',
      completionHistory: 'Completion History (Last 365 Days)',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Customize theme, accent colors, and manage your data.',
      appearance: 'Appearance',
      theme: 'Theme',
      dark: 'Dark Mode',
      light: 'Light Mode',
      colorScheme: 'Color Accent',
      account: 'Account Info',
      username: 'Username',
      backupTitle: 'Backup & Data',
      exportTitle: 'Export Backup',
      exportDesc: 'Save complete JSON backup to restore history anytime.',
      exportBtn: 'Export (JSON)',
      importTitle: 'Import Backup',
      importDesc: 'Select your backup JSON file to restore your data.',
      importBtn: 'Import (JSON)',
      confirmImport: 'WARNING: Importing this file will overwrite all current habits and logs. Do you want to proceed?',
      importSuccess: 'Restored successfully! Reloading page...',
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
    },
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ],
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    presets: {
      water: 'Drink Water 💧',
      exercise: 'Exercise 🏋️',
      reading: 'Read Book 📚',
      meditation: 'Meditation 🧘',
      addPreset: 'Quick add:',
    },
    landing: {
      nav: { features: 'Features', preview: 'Preview', signIn: 'Sign In', getStarted: 'Get Started' },
      hero: {
        badge: 'Your personal growth companion',
        title: 'Build habits that',
        titleAccent: 'actually stick.',
        subtitle: 'HabitFlow helps you track daily habits, set goals, and visualize your consistency — beautifully designed, always in sync.',
        ctaPrimary: 'Start for Free',
        ctaSecondary: 'Sign In',
      },
      features: {
        title: 'Everything you need to grow',
        subtitle: 'A complete habit tracking system, minimal and powerful.',
        items: [
          { icon: '📊', title: 'Smart Dashboard', desc: "See today's progress, streaks, and goals at a glance. Know exactly where you stand every morning." },
          { icon: '✅', title: 'Habit Grid Tracker', desc: 'A visual month-by-month grid. Check off habits daily, pin your favorites, and watch patterns emerge.' },
          { icon: '📈', title: 'Analytics & Heatmap', desc: 'GitHub-style activity heatmap and charts show your consistency trends over 365 days.' },
          { icon: '📅', title: 'Calendar & Notes', desc: 'Review any day in detail. Write daily journal entries that auto-save as you type.' },
          { icon: '🎯', title: 'Goals System', desc: 'Set monthly and yearly goals alongside your habits. Track what really matters to you.' },
          { icon: '🎨', title: 'Themes & Colors', desc: 'Dark/Light mode with 5 accent color schemes. Make it feel like yours.' }
        ]
      },
      preview: {
        title: 'See it in action',
        subtitle: 'Clean, fast, and beautiful — designed to keep you focused on what matters.',
        screens: ['Dashboard Overview', 'Habit Tracker Grid', 'Statistics & Heatmap', 'Calendar & Notes']
      },
      cta: {
        title: 'Ready to build better habits?',
        subtitle: 'Join HabitFlow today — it\'s free, private, and runs locally on your machine.',
        button: 'Get Started Now',
      },
      footer: { tagline: 'Your personal growth companion.', rights: 'All rights reserved.' }
    },
    auth: {
      login: {
        title: 'Welcome back',
        subtitle: 'Sign in to your account to continue',
        username: 'Username',
        usernamePlaceholder: 'Enter your username',
        password: 'Password',
        passwordPlaceholder: '••••••••',
        submit: 'Sign In',
        noAccount: "Don't have an account?",
        registerLink: 'Create one',
        successTitle: 'Welcome back!',
        successSubtitle: 'Redirecting to your dashboard...',
      },
      register: {
        title: 'Create account',
        subtitle: 'Start your habit tracking journey today',
        username: 'Username',
        usernamePlaceholder: 'Choose a username',
        password: 'Password',
        passwordPlaceholder: '••••••••',
        confirmPassword: 'Confirm Password',
        confirmPasswordPlaceholder: '••••••••',
        submit: 'Create Account',
        hasAccount: 'Already have an account?',
        loginLink: 'Sign in',
        hint: 'Your data is stored locally on this device.',
        successTitle: 'Account created!',
        successSubtitle: 'Redirecting to your dashboard...',
      },
      errors: {
        fillAll: 'Please fill in all fields',
        passwordMismatch: 'Passwords do not match',
        usernameTooShort: 'Username must be at least 3 characters',
        passwordTooShort: 'Password must be at least 6 characters',
        usernameTaken: 'Username is already taken',
        invalidCredentials: 'Invalid username or password',
      }
    }
  },
  kk: {
    nav: {
      dashboard: 'Деректер тақтасы',
      tracker: 'Трэкер',
      statistics: 'Статистика',
      calendar: 'Күнтізбе',
      settings: 'Баптаулар',
      syncStatus: 'Синхрондау күйі',
      syncing: 'Синхрондалуда...',
      saved: 'Сақталды',
      loggedInAs: 'Кірген қолданушы:',
      logout: 'Шығу',
    },
    dashboard: {
      welcome: 'Қайта келгеніңізбен',
      subtitle: 'Бүгінгі прогресіңіз бен мақсаттарыңыз.',
      todayProgress: 'Бүгінгі прогресс',
      habits: 'әдеттер',
      completed: 'орындалды',
      currentStreak: 'Ағымдағы серия',
      bestStreak: 'Үздік серия',
      days: 'күн',
      keepItGoing: 'Тоқтамаңыз!',
      absoluteRecord: 'Сіздің абсолютті рекордыңыз',
      totalCheckmarks: 'Барлық белгілеулер',
      monthlyGoals: 'Айлық мақсаттар',
      yearlyGoals: 'Жылдық мақсаттар',
      noMonthlyGoals: 'Айлық мақсаттар әлі қосылмаған.',
      noYearlyGoals: 'Жылдық мақсаттар әлі қосылмаған.',
      addMonthlyGoal: 'Айлық мақсат қосу...',
      addYearlyGoal: 'Жылдық мақсат қосу...',
    },
    tracker: {
      title: 'Әдеттер трэкері',
      subtitle: 'Орындалған әдеттерді күнделікті белгілеңіз. Өзгерістер автоматты сақталады.',
      searchPlaceholder: 'Әдеттерді іздеу...',
      habitsAndProgress: 'Әдеттер мен Прогресс',
      addHabit: 'Әдет қосу...',
      addCategory: 'Жаңа категория қосу...',
      confirmDeleteCategory: 'Бұл категорияны және оның барлық әдеттерін жойғыңыз келетініне сенімдісіз бе?',
      confirmDeleteHabit: 'Бұл әдетті жойғыңыз келетініне сенімдісіз бе?',
      loading: 'Трэкер кестесі жүктелуде...',
      unpin: 'Белгілеуді алып тастау',
      pin: 'Бекіту',
      renameCategory: 'Категория атын ауыстыру',
      deleteCategory: 'Категорияны жою',
      emptyCategoryHint: 'Бұл категорияда әлі әдеттер жоқ. Жоғарыда әдет қосыңыз немесе дайын үлгіні таңдаңыз:',
    },
    calendar: {
      title: 'Күнтізбе мен Жазбалар',
      subtitle: 'Орындалған әдеттерді көру және күнделікті жазбалар жазу үшін күнді таңдаңыз.',
      dailyNotes: 'Күнделікті жазбалар:',
      notesPlaceholder: 'Осы күнге арналған ойларыңызды, әсерлеріңізді немесе күнделігіңізді жазыңыз...',
      saved: 'Сақталды',
      noHabitsLogged: 'Бұл күні орындалған әдеттер жоқ.',
      completedHabits: 'Орындалған әдеттер',
    },
    statistics: {
      title: 'Аналитика мен Статистика',
      subtitle: 'Нәтижелеріңіздин тенденциясы мен тұрақтылығын бақылаңыз.',
      completionRate: 'Орындалу пайызы',
      activeHabits: 'Белсенді әдеттер',
      totalLogs: 'Барлық белгілеулер',
      categoryBreakdown: 'Категориялар бойынша әдеттер',
      completionHistory: 'Орындалу тарихы (Соңғы 365 күн)',
    },
    settings: {
      title: 'Баптаулар',
      subtitle: 'Интерфейс тақырыбын, түсті және деректеріңізді реттеңіз.',
      appearance: 'Сыртқы келбеті',
      theme: 'Тақырып',
      dark: 'Қараңғы режим',
      light: 'Жарық режим',
      colorScheme: 'Акцент түсі',
      account: 'Аккаунт ақпараты',
      username: 'Қолданушы аты',
      backupTitle: 'Резервтік көшірме мен Деректер',
      exportTitle: 'Деректерді экспорттау',
      exportDesc: 'Тарихты кез келген уақытта қалпына келтіру үшін толық JSON көшірмесін сақтаңыз.',
      exportBtn: 'Экспорттау (JSON)',
      importTitle: 'Деректерді импорттау',
      importDesc: 'Деректерді қалпына келтіру үшін JSON файлын таңдаңыз.',
      importBtn: 'Импорттау (JSON)',
      confirmImport: 'ЕСКЕРТУ: Бұл файлды импорттау ағымдағы барлық әдеттер мен жазбаларды жояды. Жалғастырасыз ба?',
      importSuccess: 'Сәтті қалпына келтірілді! Бет қайта жүктелуде...',
    },
    common: {
      save: 'Сақтау',
      cancel: 'Бас тарту',
      delete: 'Жою',
      edit: 'Өңдеу',
    },
    months: [
      'Қаңтар', 'Ақпан', 'Наурыз', 'Сәуір', 'Мамыр', 'Маусым',
      'Шілде', 'Тамыз', 'Қыркүйек', 'Қазан', 'Қараша', 'Желтоқсан'
    ],
    weekdaysShort: ['Жек', 'Дүй', 'Сей', 'Сәр', 'Бей', 'Жұм', 'Сен'],
    presets: {
      water: 'Су ішу 💧',
      exercise: 'Жаттығу жасау 🏋️',
      reading: 'Кітап оқу 📚',
      meditation: 'Медитация 🧘',
      addPreset: 'Жылдам қосу:',
    },
    landing: {
      nav: { features: 'Мүмкіндіктер', preview: 'Алдын ала қарау', signIn: 'Кіру', getStarted: 'Бастау' },
      hero: {
        badge: 'Жеке даму серігіңіз',
        title: 'Шынымен',
        titleAccent: 'ұстанатын әдеттер.',
        subtitle: 'HabitFlow күнделікті әдеттерді қадағалауға, мақсат қоюға және тұрақтылықты визуализациялауға көмектеседі — әдемі дизайн, әрдайым синхронды.',
        ctaPrimary: 'Тегін бастау',
        ctaSecondary: 'Кіру',
      },
      features: {
        title: 'Өсу үшін қажет нәрсенің бәрі',
        subtitle: 'Минималды және қуатты — толық әдеттерді қадағалау жүйесі.',
        items: [
          { icon: '📊', title: 'Ақылды деректер тақтасы', desc: 'Бүгінгі прогресті, серияларды және мақсаттарды бір қарауда көріңіз. Әр таңда қайда тұрғаныңызды біліңіз.' },
          { icon: '✅', title: 'Әдеттер торы', desc: 'Айлық визуалды тор. Күн сайын әдеттерді белгілеңіз, үздіктерін бекітіңіз және нәтижені көріңіз.' },
          { icon: '📈', title: 'Аналитика және жылу картасы', desc: 'GitHub стиліндегі белсенділік картасы 365 күндегі тұрақтылықты көрсетеді.' },
          { icon: '📅', title: 'Күнтізбе және жазбалар', desc: 'Кез келген күнді егжей-тегжейлі қарап шығыңыз. Күнделікті жазбалар автоматты сақталады.' },
          { icon: '🎯', title: 'Мақсаттар жүйесі', desc: 'Айлық және жылдық мақсаттар қойыңыз. Маңызды нәрселерді қадағалаңыз.' },
          { icon: '🎨', title: 'Тақырыптар және түстер', desc: 'Қараңғы/Жарық режим, 5 акцент түс схемасы. Сіздікі сияқты сезіндіріңіз.' }
        ]
      },
      preview: {
        title: 'Қалай жұмыс істінін көріңіз',
        subtitle: 'Таза, жылдам және әдемі — маңызды нәрсеге назар аударуға арналған.',
        screens: ['Деректер тақтасы', 'Әдеттер торы', 'Статистика және жылу картасы', 'Күнтізбе мен жазбалар']
      },
      cta: {
        title: 'Жақсы әдеттер қалыптастыруға дайынсыз ба?',
        subtitle: 'HabitFlow-ға бүгін қосылыңыз — тегін, жеке және компьютеріңізде жергілікті жұмыс істейді.',
        button: 'Қазір бастау',
      },
      footer: { tagline: 'Жеке даму серігіңіз.', rights: 'Барлық құқықтар қорғалған.' }
    },
    auth: {
      login: {
        title: 'Қайта келгеніңізбен',
        subtitle: 'Жалғастыру үшін аккаунтыңызға кіріңіз',
        username: 'Қолданушы аты',
        usernamePlaceholder: 'Қолданушы атыңызды енгізіңіз',
        password: 'Құпия сөз',
        passwordPlaceholder: '••••••••',
        submit: 'Кіру',
        noAccount: 'Аккаунтыңыз жоқ па?',
        registerLink: 'Тіркелу',
        successTitle: 'Қайта келгеніңізбен!',
        successSubtitle: 'Деректер тақтасына бағытталуда...',
      },
      register: {
        title: 'Аккаунт жасау',
        subtitle: 'Бүгін әдеттерді қадағалауды бастаңыз',
        username: 'Қолданушы аты',
        usernamePlaceholder: 'Қолданушы атын таңдаңыз',
        password: 'Құпия сөз',
        passwordPlaceholder: '••••••••',
        confirmPassword: 'Құпия сөзді растаңыз',
        confirmPasswordPlaceholder: '••••••••',
        submit: 'Аккаунт жасау',
        hasAccount: 'Аккаунтыңыз бар ма?',
        loginLink: 'Кіру',
        hint: 'Деректеріңіз осы құрылғыда жергілікті сақталады.',
        successTitle: 'Аккаунт жасалды!',
        successSubtitle: 'Деректер тақтасына бағытталуда...',
      },
      errors: {
        fillAll: 'Барлық өрістерді толтырыңыз',
        passwordMismatch: 'Құпия сөздер сәйкес келмейді',
        usernameTooShort: 'Қолданушы аты кемінде 3 таңбадан тұруы керек',
        passwordTooShort: 'Құпия сөз кемінде 6 таңбадан тұруы керек',
        usernameTaken: 'Бұл қолданушы аты бос емес',
        invalidCredentials: 'Қолданушы аты немесе құпия сөз қате',
      }
    }
  }
};

// ─── Theme & Accent Manager ──────────────────────────────────────────
const ThemeManager = {
  apply(theme, colorScheme) {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    const schemeColors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.emerald;
    root.style.setProperty('--accent', schemeColors.accent);
    root.style.setProperty('--accent-hover', schemeColors.hover);
    root.style.setProperty('--accent-muted', schemeColors.muted);
  },

  load(username) {
    const userData = LocalDB.getUserData(username);
    const { theme, colorScheme } = userData.settings || DEFAULT_SETTINGS;
    this.apply(theme, colorScheme);
  },

  save(username, settingsUpdate) {
    const userData = LocalDB.getUserData(username);
    userData.settings = { ...(userData.settings || DEFAULT_SETTINGS), ...settingsUpdate };
    LocalDB.saveUserData(username, userData);
    this.apply(userData.settings.theme, userData.settings.colorScheme);
  }
};

// ─── Localization Manager ───────────────────────────────────────────
const LocaleManager = {
  get() {
    let l = localStorage.getItem('habit_tracker_locale');
    return (l === 'en' || l === 'kk') ? l : 'en';
  },

  set(locale) {
    localStorage.setItem('habit_tracker_locale', locale);
    window.dispatchEvent(new Event('localeChanged'));
  },

  t(path, section = null) {
    const locale = this.get();
    const keys = path.split('.');
    
    let current = section ? section[locale] : TRANSLATIONS[locale];
    
    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key];
      } else {
        // Fallback to English
        let fallback = section ? section['en'] : TRANSLATIONS['en'];
        for (const k of keys) {
          if (fallback && fallback[k] !== undefined) {
            fallback = fallback[k];
          } else {
            return path;
          }
        }
        return typeof fallback === 'string' ? fallback : path;
      }
    }
    return typeof current === 'string' ? current : path;
  },

  translateDOM() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const path = el.getAttribute('data-i18n');
      el.textContent = this.t(path);
    });

    const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(el => {
      const path = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', this.t(path));
    });
  }
};

// ─── UI Layout Builder & Sidebar Injector ───────────────────────────
const UILayout = {
  inject(username) {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) return;

    const currentFile = window.location.pathname.split('/').pop() || 'dashboard.html';
    const isTabActive = (file) => currentFile.startsWith(file) ? 'bg-accent/15 text-accent border-l-2 border-accent pl-2.5' : 'text-foreground/75 hover:text-foreground hover:bg-card-border/40';
    const isIconActive = (file) => currentFile.startsWith(file) ? 'text-accent' : 'text-foreground/50';

    const locale = LocaleManager.get();
    const t = (p) => LocaleManager.t(p);

    // Render HTML Structure for Desktop and Mobile Drawer Sidebar
    sidebarContainer.innerHTML = `
      <!-- Mobile Header -->
      <header class="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar border-b border-sidebar-border sticky top-0 z-40 w-full">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-lg">
            H
          </div>
          <span class="font-semibold tracking-tight text-foreground">HabitFlow</span>
        </div>
        <div class="flex items-center gap-3">
          <!-- Language switcher mobile -->
          <div class="flex items-center gap-1 bg-card-border/30 p-1 rounded-lg border border-card-border/50">
            <i data-lucide="globe" class="w-3.5 h-3.5 text-foreground/50 ml-1 mr-0.5 shrink-0"></i>
            <button onclick="LocaleManager.set('en')" class="px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${locale === 'en' ? 'bg-accent text-white shadow-xs' : 'text-foreground/60 hover:text-foreground'}">EN</button>
            <button onclick="LocaleManager.set('kk')" class="px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${locale === 'kk' ? 'bg-accent text-white shadow-xs' : 'text-foreground/60 hover:text-foreground'}">ҚАЗ</button>
          </div>
          <div class="flex items-center gap-1.5 text-xs text-foreground/50">
            <i data-lucide="cloud" class="w-3.5 h-3.5 text-emerald-500"></i>
          </div>
          <button id="mobile-menu-btn" class="p-1 rounded-lg border border-sidebar-border text-foreground/75">
            <i data-lucide="menu" class="w-5 h-5" id="mobile-menu-icon"></i>
          </button>
        </div>
      </header>

      <!-- Mobile Drawer Overlay -->
      <div id="mobile-overlay" class="fixed inset-0 bg-black/50 z-30 hidden md:hidden"></div>

      <!-- Sidebar Container -->
      <aside id="sidebar-drawer" class="fixed top-0 bottom-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border flex flex-col justify-between transition-transform duration-300 -translate-x-full md:translate-x-0 md:sticky md:h-screen">
        <div>
          <!-- Branding -->
          <div class="px-6 py-5 border-b border-sidebar-border flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-extrabold text-base shadow-sm">
                H
              </div>
              <span class="font-semibold tracking-tight text-foreground text-base">HabitFlow</span>
            </div>
          </div>

          <!-- Navigation Links -->
          <div class="px-4 mt-2 py-4 space-y-1">
            <a href="./dashboard.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isTabActive('dashboard')}">
              <i data-lucide="layout-dashboard" class="w-4 h-4 ${isIconActive('dashboard')}"></i>
              <span>${t('nav.dashboard')}</span>
            </a>
            <a href="./tracker.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isTabActive('tracker')}">
              <i data-lucide="check-square" class="w-4 h-4 ${isIconActive('tracker')}"></i>
              <span>${t('nav.tracker')}</span>
            </a>
            <a href="./statistics.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isTabActive('statistics')}">
              <i data-lucide="bar-chart-3" class="w-4 h-4 ${isIconActive('statistics')}"></i>
              <span>${t('nav.statistics')}</span>
            </a>
            <a href="./calendar.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isTabActive('calendar')}">
              <i data-lucide="calendar" class="w-4 h-4 ${isIconActive('calendar')}"></i>
              <span>${t('nav.calendar')}</span>
            </a>
            <a href="./settings.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isTabActive('settings')}">
              <i data-lucide="settings" class="w-4 h-4 ${isIconActive('settings')}"></i>
              <span>${t('nav.settings')}</span>
            </a>
          </div>
        </div>

        <!-- Sidebar Bottom Footer -->
        <div class="p-4 border-t border-sidebar-border space-y-3">
          <!-- Language Switcher Desktop -->
          <div class="flex items-center justify-between px-1">
            <span class="text-xs text-foreground/50 font-medium">Language / Тіл</span>
            <div class="flex items-center gap-1 bg-card-border/30 p-1 rounded-lg border border-card-border/50">
              <button onclick="LocaleManager.set('en')" class="px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${locale === 'en' ? 'bg-accent text-white shadow-xs' : 'text-foreground/60 hover:text-foreground'}">EN</button>
              <button onclick="LocaleManager.set('kk')" class="px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${locale === 'kk' ? 'bg-accent text-white shadow-xs' : 'text-foreground/60 hover:text-foreground'}">ҚАЗ</button>
            </div>
          </div>

          <!-- Sync Badge -->
          <div class="flex items-center justify-between px-3 py-2 bg-card-border/20 rounded-lg text-xs">
            <span class="text-foreground/50 font-medium">${t('nav.syncStatus')}</span>
            <div class="flex items-center gap-1.5 font-medium text-emerald-500">
              <i data-lucide="cloud" class="w-3.5 h-3.5"></i>
              <span>${t('nav.saved')}</span>
            </div>
          </div>

          <!-- Profile info & Logout -->
          <div class="flex items-center justify-between gap-2 px-1">
            <div class="min-w-0">
              <p class="text-xs text-foreground/50 font-medium">${t('nav.loggedInAs')}</p>
              <p class="text-sm font-semibold truncate text-foreground">${username}</p>
            </div>
            <button id="logout-btn" title="${t('nav.logout')}" class="p-2 rounded-lg text-foreground/60 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer">
              <i data-lucide="log-out" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </aside>
    `;

    // Mobile Sidebar Functionality
    const menuBtn = document.getElementById('mobile-menu-btn');
    const overlay = document.getElementById('mobile-overlay');
    const drawer = document.getElementById('sidebar-drawer');

    if (menuBtn && overlay && drawer) {
      const toggleMenu = () => {
        const isOpen = drawer.classList.contains('translate-x-0');
        if (isOpen) {
          drawer.classList.remove('translate-x-0');
          drawer.classList.add('-translate-x-full');
          overlay.classList.add('hidden');
        } else {
          drawer.classList.remove('-translate-x-full');
          drawer.classList.add('translate-x-0');
          overlay.classList.remove('hidden');
        }
      };

      menuBtn.addEventListener('click', toggleMenu);
      overlay.addEventListener('click', toggleMenu);
    }

    // Attach Logout Event
    document.getElementById('logout-btn').addEventListener('click', () => {
      Auth.logout();
    });

    // Re-create icons via Lucide CDN
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
};

// ─── Setup Global Event Listeners ──────────────────────────────────
window.addEventListener('localeChanged', () => {
  const username = Auth.getCurrentUser();
  if (username) {
    UILayout.inject(username);
  }
  LocaleManager.translateDOM();
});

// Run theme check immediately
(function init() {
  const user = Auth.getCurrentUser();
  if (user) {
    // Apply user settings
    const userData = LocalDB.getUserData(user);
    const { theme, colorScheme } = userData.settings || DEFAULT_SETTINGS;
    ThemeManager.apply(theme, colorScheme);
  } else {
    // Default theme check
    const root = document.documentElement;
    root.classList.add('dark');
  }
})();
