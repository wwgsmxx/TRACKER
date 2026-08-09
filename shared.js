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

// ─── API Client Legacy Cleaned ──────────────────────────────────────

// ─── LocalDB — локальный кэш UI и сессии ──────────────────────────────
class LocalDB {
  static _cacheKey(email) {
    return `habitflow_userdata_${(email || '').trim().toLowerCase()}`;
  }

  static getUserData(email) {
    const key = (email || '').trim().toLowerCase();
    const cached = localStorage.getItem(this._cacheKey(key));
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }
    return this._defaultData(key);
  }

  static _defaultData(email) {
    return {
      email,
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
      notes: {},
      monthlyGoals: [],
      yearlyGoals: []
    };
  }

  static saveUserData(email, userData) {
    const key = (email || '').trim().toLowerCase();
    localStorage.setItem(this._cacheKey(key), JSON.stringify(userData));
    window.dispatchEvent(new CustomEvent('habitflow_data_saved'));
    CloudDB.syncToServer(userData);
  }

  static clearCache(email) {
    const key = (email || '').trim().toLowerCase();
    localStorage.removeItem(this._cacheKey(key));
  }
}

// ─── CloudDB — синхронизация с Supabase Database ───────────────────────
const CloudDB = {
  _syncTimer: null,

  async loadFromServer() {
    const client = window.getSupabaseClient ? window.getSupabaseClient() : window.supabaseClient;
    if (!client) {
      console.warn('CloudDB: Supabase Client не инициализирован');
      return null;
    }
    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) return null;

      const userId = user.id;
      const email = user.email;

      // Загружаем все сущности параллельно
      const [
        { data: settingsData },
        { data: categoriesData },
        { data: habitsData },
        { data: logsData },
        { data: notesData },
        { data: mGoalsData },
        { data: yGoalsData }
      ] = await Promise.all([
        client.from('user_settings').select('*').eq('user_id', userId).single(),
        client.from('categories').select('*').eq('user_id', userId).order('sort_order', { ascending: true }),
        client.from('habits').select('*').eq('user_id', userId).order('sort_order', { ascending: true }),
        client.from('habit_logs').select('*').eq('user_id', userId),
        client.from('daily_notes').select('*').eq('user_id', userId),
        client.from('monthly_goals').select('*').eq('user_id', userId),
        client.from('yearly_goals').select('*').eq('user_id', userId)
      ]);

      const formattedSettings = settingsData ? {
        theme: settingsData.theme || 'dark',
        colorScheme: settingsData.color_scheme || 'emerald'
      } : { ...DEFAULT_SETTINGS };

      const formattedCategories = (categoriesData || []).map(c => ({
        id: c.id,
        name: c.name,
        order: c.sort_order || 0
      }));

      const formattedHabits = (habitsData || []).map(h => ({
        id: h.id,
        categoryId: h.category_id,
        name: h.name,
        order: h.sort_order || 0,
        isPinned: h.is_pinned || false,
        isArchived: h.is_archived || false
      }));

      const formattedLogs = (logsData || []).map(l => ({
        habitId: l.habit_id,
        date: l.log_date,
        completed: l.completed
      }));

      const formattedNotes = {};
      (notesData || []).forEach(n => {
        formattedNotes[n.note_date] = n.content;
      });

      const formattedMonthlyGoals = (mGoalsData || []).map(g => ({
        id: g.id,
        month: g.month_str,
        content: g.content,
        completed: g.completed
      }));

      const formattedYearlyGoals = (yGoalsData || []).map(g => ({
        id: g.id,
        year: g.year_str,
        content: g.content,
        completed: g.completed
      }));

      const userData = {
        email,
        settings: formattedSettings,
        categories: formattedCategories,
        habits: formattedHabits,
        logs: formattedLogs,
        notes: formattedNotes,
        monthlyGoals: formattedMonthlyGoals,
        yearlyGoals: formattedYearlyGoals
      };

      // Сохраняем свежие данные в локальный кэш
      localStorage.setItem(LocalDB._cacheKey(email), JSON.stringify(userData));
      return userData;

    } catch (e) {
      console.warn('CloudDB: Ошибка при загрузке из Supabase:', e);
      return null;
    }
  },

  syncToServer(userData) {
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(async () => {
      const client = window.getSupabaseClient ? window.getSupabaseClient() : window.supabaseClient;
      if (!client) return;
      try {
        const { data: { user } } = await client.auth.getUser();
        if (!user) return;
        const userId = user.id;

        // 1. Settings
        if (userData.settings) {
          await client.from('user_settings').upsert({
            user_id: userId,
            theme: userData.settings.theme || 'dark',
            color_scheme: userData.settings.colorScheme || 'emerald',
            updated_at: new Date().toISOString()
          });
        }

        // 2. Categories
        if (userData.categories) {
          const catRows = userData.categories.map(c => ({
            id: c.id,
            user_id: userId,
            name: c.name,
            sort_order: c.order || 0
          }));
          if (catRows.length > 0) {
            await client.from('categories').upsert(catRows);
          }
        }

        // 3. Habits
        if (userData.habits) {
          const habitRows = userData.habits.map(h => ({
            id: h.id,
            user_id: userId,
            category_id: h.categoryId,
            name: h.name,
            sort_order: h.order || 0,
            is_pinned: !!h.isPinned,
            is_archived: !!h.isArchived
          }));
          if (habitRows.length > 0) {
            await client.from('habits').upsert(habitRows);
          }
        }

        // 4. Logs
        if (userData.logs) {
          const logRows = userData.logs.map(l => ({
            user_id: userId,
            habit_id: l.habitId,
            log_date: l.date,
            completed: !!l.completed,
            updated_at: new Date().toISOString()
          }));
          if (logRows.length > 0) {
            await client.from('habit_logs').upsert(logRows);
          }
        }

        // 5. Notes
        if (userData.notes) {
          const noteRows = Object.keys(userData.notes).map(dateKey => ({
            user_id: userId,
            note_date: dateKey,
            content: userData.notes[dateKey] || '',
            updated_at: new Date().toISOString()
          }));
          if (noteRows.length > 0) {
            await client.from('daily_notes').upsert(noteRows);
          }
        }

        // 6. Monthly Goals
        if (userData.monthlyGoals) {
          const mGoalRows = userData.monthlyGoals.map(g => ({
            id: g.id,
            user_id: userId,
            month_str: g.month,
            content: g.content,
            completed: !!g.completed
          }));
          if (mGoalRows.length > 0) {
            await client.from('monthly_goals').upsert(mGoalRows);
          }
        }

        // 7. Yearly Goals
        if (userData.yearlyGoals) {
          const yGoalRows = userData.yearlyGoals.map(g => ({
            id: g.id,
            user_id: userId,
            year_str: String(g.year),
            content: g.content,
            completed: !!g.completed
          }));
          if (yGoalRows.length > 0) {
            await client.from('yearly_goals').upsert(yGoalRows);
          }
        }

        window.dispatchEvent(new CustomEvent('habitflow_cloud_saved'));
      } catch (e) {
        console.warn('CloudDB: Не удалось синхронизировать с Supabase:', e.message);
      }
    }, 500);
  }
};

// Helper to validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ─── Auth System Module (Supabase Auth) ───────────────────────────────
const Auth = {
  async register(email, password) {
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed || !password) throw new Error('fillAll');
    if (!isValidEmail(trimmed)) throw new Error('invalidEmail');
    if (password.length < 6) throw new Error('passwordTooShort');

    const client = window.getSupabaseClient ? window.getSupabaseClient() : window.supabaseClient;
    if (!client) throw new Error('Supabase client is not ready');

    const { data, error } = await client.auth.signUp({
      email: trimmed,
      password: password
    });

    if (error) {
      if (error.message.includes('already registered')) throw new Error('emailTaken');
      throw new Error(error.message);
    }

    if (data.user) {
      this.setSession(data.user.email);
      // Если у нас были дефолтные/старые локальные данные, инициализируем базу Supabase
      const defaultData = LocalDB.getUserData(trimmed);
      CloudDB.syncToServer(defaultData);
    }

    return trimmed;
  },

  async login(email, password) {
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed || !password) throw new Error('fillAll');
    if (!isValidEmail(trimmed)) throw new Error('invalidEmail');

    const client = window.getSupabaseClient ? window.getSupabaseClient() : window.supabaseClient;
    if (!client) throw new Error('Supabase client is not ready');

    const { data, error } = await client.auth.signInWithPassword({
      email: trimmed,
      password: password
    });

    if (error) {
      console.error('Supabase Auth error:', error.message);
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('invalidCredentials');
      }
      if (error.message.includes('Email not confirmed')) {
        throw new Error('Email не подтвержден! Пожалуйста, проверьте почту или отключите Email Confirmation в Supabase Dashboard -> Authentication -> Providers -> Email');
      }
      throw new Error(error.message);
    }

    if (data.user) {
      this.setSession(data.user.email);
      // Загружаем актуальный прогресс пользователя с сервера
      await CloudDB.loadFromServer();
    }

    return trimmed;
  },

  async logout() {
    const email = this.getCurrentUser();
    if (email) LocalDB.clearCache(email);
    localStorage.removeItem('habitflow_session');

    if (window.supabaseClient) {
      await window.supabaseClient.auth.signOut();
    }

    window.location.href = './login.html';
  },

  setSession(email) {
    localStorage.setItem('habitflow_session', JSON.stringify({ email, loginTime: Date.now() }));
  },

  getCurrentUser() {
    const sessionStr = localStorage.getItem('habitflow_session');
    if (!sessionStr) return null;
    try {
      const session = JSON.parse(sessionStr);
      return (session.email || '').trim().toLowerCase() || null;
    } catch (e) {
      return null;
    }
  },

  checkAuth(isProtectedRoute) {
    const user = this.getCurrentUser();
    const currentFile = window.location.pathname.split('/').pop() || 'index.html';

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
        username: 'Email address',
        usernamePlaceholder: 'name@example.com',
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
        username: 'Email address',
        usernamePlaceholder: 'name@example.com',
        password: 'Password',
        passwordPlaceholder: '••••••••',
        confirmPassword: 'Confirm Password',
        confirmPasswordPlaceholder: '••••••••',
        submit: 'Create Account',
        hasAccount: 'Already have an account?',
        loginLink: 'Sign in',
        hint: 'Your data is saved automatically and synced to your account.',
        successTitle: 'Account created!',
        successSubtitle: 'Redirecting to your dashboard...',
      },
      errors: {
        fillAll: 'Please fill in all fields',
        passwordMismatch: 'Passwords do not match',
        invalidEmail: 'Please enter a valid email address',
        passwordTooShort: 'Password must be at least 6 characters',
        emailTaken: 'An account with this email already exists',
        usernameTaken: 'An account with this email already exists',
        invalidCredentials: 'Invalid email address or password',
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
      username: 'Электрондық пошта',
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
        username: 'Электрондық пошта',
        usernamePlaceholder: 'name@example.com',
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
        username: 'Электрондық пошта',
        usernamePlaceholder: 'name@example.com',
        password: 'Құпия сөз',
        passwordPlaceholder: '••••••••',
        confirmPassword: 'Құпия сөзді растаңыз',
        confirmPasswordPlaceholder: '••••••••',
        submit: 'Аккаунт жасау',
        hasAccount: 'Аккаунтыңыз бар ма?',
        loginLink: 'Кіру',
        hint: 'Деректеріңіз автоматты түрде сақталады және синхрондалады.',
        successTitle: 'Аккаунт жасалды!',
        successSubtitle: 'Деректер тақтасына бағытталуда...',
      },
      errors: {
        fillAll: 'Барлық өрістерді толтырыңыз',
        passwordMismatch: 'Құпия сөздер сәйкес келмейді',
        invalidEmail: 'Жарамды электрондық пошта мекенжайын енгізіңіз',
        passwordTooShort: 'Құпия сөз кемінде 6 таңбадан тұруы керек',
        emailTaken: 'Бұл электрондық пошта тіркелген',
        usernameTaken: 'Бұл электрондық пошта тіркелген',
        invalidCredentials: 'Электрондық пошта немесе құпия сөз қате',
      }
    }
  }
};

// ─── Theme & Accent Manager ──────────────────────────────────────────
const ThemeManager = {
  getTheme() {
    return localStorage.getItem('habitflow_theme') || 'dark';
  },

  apply(theme, colorScheme = 'emerald') {
    const root = document.documentElement;
    const currentTheme = theme || this.getTheme();

    if (currentTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('habitflow_theme', currentTheme);

    const schemeColors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.emerald;
    root.style.setProperty('--accent', schemeColors.accent);
    root.style.setProperty('--accent-hover', schemeColors.hover);
    root.style.setProperty('--accent-muted', schemeColors.muted);
  },

  load(username) {
    if (username) {
      const userData = LocalDB.getUserData(username);
      const { theme, colorScheme } = userData.settings || DEFAULT_SETTINGS;
      this.apply(theme, colorScheme);
    } else {
      const theme = this.getTheme();
      this.apply(theme, 'emerald');
    }
  },

  save(username, settingsUpdate) {
    if (username) {
      const userData = LocalDB.getUserData(username);
      userData.settings = { ...(userData.settings || DEFAULT_SETTINGS), ...settingsUpdate };
      LocalDB.saveUserData(username, userData);
      this.apply(userData.settings.theme, userData.settings.colorScheme);
    } else if (settingsUpdate.theme) {
      this.apply(settingsUpdate.theme, 'emerald');
    }
  },

  toggle(username) {
    const current = this.getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    this.save(username, { theme: next });
    return next;
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

          <!-- Sync Badge (dynamic cloud status) -->
          <div id="sync-status-badge" class="flex items-center justify-between px-3 py-2 bg-card-border/20 rounded-lg text-xs">
            <span class="text-foreground/50 font-medium">${t('nav.syncStatus')}</span>
            <div class="flex items-center gap-1.5 font-medium text-emerald-500">
              <i data-lucide="cloud" class="w-3.5 h-3.5"></i>
              <span id="sync-status-text">${t('nav.saved')}</span>
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
    ThemeManager.load(user);
  } else {
    // Default or stored theme check
    const theme = ThemeManager.getTheme();
    ThemeManager.apply(theme, 'emerald');
  }

  // Cross-tab synchronization listener (localStorage cache updates)
  window.addEventListener('storage', (e) => {
    if (e.key === 'habitflow_theme') {
      const activeUser = Auth.getCurrentUser();
      if (activeUser) {
        ThemeManager.load(activeUser);
      } else {
        ThemeManager.apply(ThemeManager.getTheme(), 'emerald');
      }
    }
    if (e.key && e.key.startsWith('habitflow_userdata_')) {
      window.dispatchEvent(new CustomEvent('habitflow_sync'));
    }
  });

  // Cloud save indicator: show "Syncing..." → "Saved ☁️" in sidebar
  window.addEventListener('habitflow_data_saved', () => {
    const badge = document.getElementById('sync-status-badge');
    const txt = document.getElementById('sync-status-text');
    if (!badge || !txt) return;
    const locale = LocaleManager.get();
    txt.textContent = TRANSLATIONS[locale].nav.syncing || 'Syncing...';
    badge.querySelector('i')?.setAttribute('data-lucide', 'loader');
    if (window.lucide) window.lucide.createIcons();
  });

  window.addEventListener('habitflow_cloud_saved', () => {
    const badge = document.getElementById('sync-status-badge');
    const txt = document.getElementById('sync-status-text');
    if (!badge || !txt) return;
    const locale = LocaleManager.get();
    txt.textContent = TRANSLATIONS[locale].nav.saved || 'Saved';
    badge.querySelector('i')?.setAttribute('data-lucide', 'cloud');
    if (window.lucide) window.lucide.createIcons();
  });
})();
