/* ──────────────────────────────────────────── */
/* HabitFlow - Dashboard Scripting              */
/* ──────────────────────────────────────────── */

// Streak calculation helper
function calculateStreak(dates, todayStr) {
  if (!dates || dates.length === 0) {
    return { current: 0, best: 0 };
  }

  // Sort unique dates in ascending order
  const uniqueDates = Array.from(new Set(dates)).sort();
  
  let bestStreak = 0;
  let currentStreak = 0;
  let tempStreak = 0;

  // Convert dates to timestamps at midnight to handle date diffs
  const parsedDates = uniqueDates.map(d => new Date(d + 'T00:00:00'));

  if (parsedDates.length === 0) {
    return { current: 0, best: 0 };
  }

  // Helper to check if two dates are consecutive days
  const isConsecutive = (d1, d2) => {
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
  };

  // Calculate best streak
  tempStreak = 1;
  bestStreak = 1;
  for (let i = 1; i < parsedDates.length; i++) {
    if (isConsecutive(parsedDates[i - 1], parsedDates[i])) {
      tempStreak++;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak);

  // Calculate current streak
  const lastDateStr = uniqueDates[uniqueDates.length - 1];
  const lastDate = new Date(lastDateStr + 'T00:00:00');
  const today = new Date(todayStr + 'T00:00:00');

  const diffTime = today.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // If the last completed date was today or yesterday, we can calculate current streak
  if (diffDays === 0 || diffDays === 1) {
    currentStreak = 1;
    for (let i = uniqueDates.length - 1; i > 0; i--) {
      const d1 = new Date(uniqueDates[i] + 'T00:00:00');
      const d2 = new Date(uniqueDates[i - 1] + 'T00:00:00');
      if (isConsecutive(d2, d1)) {
        currentStreak++;
      } else {
        break;
      }
    }
  } else {
    currentStreak = 0;
  }

  return {
    current: currentStreak,
    best: bestStreak,
  };
}

document.addEventListener('DOMContentLoaded', () => {
  // Check authorization
  const username = Auth.getCurrentUser();
  if (!username) {
    Auth.checkAuth(true);
    return;
  }

  // Load and apply themes
  ThemeManager.load(username);

  // Inject sidebar layout
  UILayout.inject(username);

  // Set user display name
  document.getElementById('user-display-name').textContent = username;

  // Date constants
  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);
  const currentMonthStr = today.toISOString().substring(0, 7); // "YYYY-MM"
  const currentYearStr = today.getFullYear();
  const currentMonthIdx = today.getMonth();

  // Load User Data
  let userData = LocalDB.getUserData(username);

  // Sync fresh data from Supabase
  CloudDB.loadFromServer().then(freshData => {
    if (freshData) {
      userData = freshData;
      updateMetrics();
      renderGoals();
    }
  });

  // Translate Date Badge
  function updateDateBadge() {
    const locale = LocaleManager.get();
    const months = TRANSLATIONS[locale].months;
    const currentMonthName = months[currentMonthIdx];
    document.getElementById('header-date').textContent = `${today.getDate()} ${currentMonthName} ${currentYearStr}`;
    document.getElementById('metric-month-name').textContent = currentMonthName;
    document.getElementById('metric-year-name').textContent = String(currentYearStr);
    document.getElementById('monthly-badge-label').textContent = currentMonthName;
    document.getElementById('yearly-badge-label').textContent = String(currentYearStr);
  }

  // Update card metrics
  function updateMetrics() {
    const habits = userData.habits.filter(h => !h.isArchived);
    const totalHabits = habits.length;
    
    // 1. Today's Progress
    const completedToday = habits.filter(h => {
      return userData.logs.some(log => log.habitId === h.id && log.date === todayStr && log.completed);
    });
    const completedCount = completedToday.length;
    const completionPercent = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;

    document.getElementById('metric-progress-value').textContent = String(completedCount);
    document.getElementById('metric-progress-total').textContent = String(totalHabits);
    document.getElementById('metric-progress-percent').textContent = String(completionPercent);
    document.getElementById('metric-progress-bar').style.width = `${completionPercent}%`;

    // 2. Streaks
    const allCompletedDates = [];
    userData.logs.forEach(log => {
      if (log.completed) allCompletedDates.push(log.date);
    });
    const uniqueDates = Array.from(new Set(allCompletedDates));
    const streak = calculateStreak(uniqueDates, todayStr);

    document.getElementById('metric-current-streak').textContent = String(streak.current);
    document.getElementById('metric-best-streak').textContent = String(streak.best);

    // 3. Month & Year Checkmarks
    let monthLogsCount = 0;
    let yearLogsCount = 0;

    userData.logs.forEach(log => {
      if (log.completed) {
        if (log.date.startsWith(currentMonthStr)) {
          monthLogsCount++;
        }
        if (log.date.startsWith(String(currentYearStr))) {
          yearLogsCount++;
        }
      }
    });

    document.getElementById('metric-month-count').textContent = String(monthLogsCount);
    document.getElementById('metric-year-count').textContent = String(yearLogsCount);
  }

  // Render Goal Lists
  function renderGoals() {
    const locale = LocaleManager.get();
    const t = TRANSLATIONS[locale].dashboard;

    // 1. Monthly Goals
    const monthlyContainer = document.getElementById('monthly-goals-list');
    monthlyContainer.innerHTML = '';
    const monthlyList = userData.monthlyGoals.filter(g => g.month === currentMonthStr);

    if (monthlyList.length === 0) {
      monthlyContainer.innerHTML = `
        <div class="text-center py-12 text-foreground/40 text-sm font-medium">
          ${t.noMonthlyGoals}
        </div>
      `;
    } else {
      monthlyList.forEach(goal => {
        monthlyContainer.innerHTML += `
          <div class="flex items-center justify-between gap-3 p-3 bg-background border border-card-border rounded-xl transition-all hover:border-accent/30">
            <label class="flex items-center gap-3 cursor-pointer select-none min-w-0 flex-1">
              <input type="checkbox" ${goal.completed ? 'checked' : ''} id="goal-chk-${goal.id}"
                     class="w-4 h-4 rounded border-card-border text-accent focus:ring-accent bg-transparent">
              <span class="text-sm font-medium truncate ${goal.completed ? 'line-through text-foreground/40' : 'text-foreground/80'}">
                ${goal.content}
              </span>
            </label>
            <button id="goal-del-${goal.id}" class="p-1 text-foreground/40 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        `;
      });

      // Bind events
      monthlyList.forEach(goal => {
        document.getElementById(`goal-chk-${goal.id}`).addEventListener('change', () => toggleGoal(goal.id, 'monthly'));
        document.getElementById(`goal-del-${goal.id}`).addEventListener('click', () => deleteGoal(goal.id, 'monthly'));
      });
    }

    // 2. Yearly Goals
    const yearlyContainer = document.getElementById('yearly-goals-list');
    yearlyContainer.innerHTML = '';
    const yearlyList = userData.yearlyGoals.filter(g => g.year === currentYearStr);

    if (yearlyList.length === 0) {
      yearlyContainer.innerHTML = `
        <div class="text-center py-12 text-foreground/40 text-sm font-medium">
          ${t.noYearlyGoals}
        </div>
      `;
    } else {
      yearlyList.forEach(goal => {
        yearlyContainer.innerHTML += `
          <div class="flex items-center justify-between gap-3 p-3 bg-background border border-card-border rounded-xl transition-all hover:border-violet-500/20">
            <label class="flex items-center gap-3 cursor-pointer select-none min-w-0 flex-1">
              <input type="checkbox" ${goal.completed ? 'checked' : ''} id="goal-chk-${goal.id}"
                     class="w-4 h-4 rounded border-card-border text-violet-500 focus:ring-violet-500 bg-transparent">
              <span class="text-sm font-medium truncate ${goal.completed ? 'line-through text-foreground/40' : 'text-foreground/80'}">
                ${goal.content}
              </span>
            </label>
            <button id="goal-del-${goal.id}" class="p-1 text-foreground/40 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        `;
      });

      // Bind events
      yearlyList.forEach(goal => {
        document.getElementById(`goal-chk-${goal.id}`).addEventListener('change', () => toggleGoal(goal.id, 'yearly'));
        document.getElementById(`goal-del-${goal.id}`).addEventListener('click', () => deleteGoal(goal.id, 'yearly'));
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // Toggling goal status
  function toggleGoal(id, type) {
    if (type === 'monthly') {
      userData.monthlyGoals = userData.monthlyGoals.map(g => g.id === id ? { ...g, completed: !g.completed } : g);
    } else {
      userData.yearlyGoals = userData.yearlyGoals.map(g => g.id === id ? { ...g, completed: !g.completed } : g);
    }
    LocalDB.saveUserData(username, userData);
    renderGoals();
  }

  // Deleting goals
  function deleteGoal(id, type) {
    if (type === 'monthly') {
      userData.monthlyGoals = userData.monthlyGoals.filter(g => g.id !== id);
    } else {
      userData.yearlyGoals = userData.yearlyGoals.filter(g => g.id !== id);
    }
    LocalDB.saveUserData(username, userData);
    renderGoals();
  }

  // Add goal form bindings
  document.getElementById('monthly-goal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('monthly-goal-input');
    const content = input.value.trim();
    if (!content) return;

    const newGoal = {
      id: 'mgoal-' + Math.random().toString(36).substr(2, 9),
      month: currentMonthStr,
      content,
      completed: false,
      createdAt: new Date().toISOString()
    };

    userData.monthlyGoals.push(newGoal);
    LocalDB.saveUserData(username, userData);
    
    input.value = '';
    renderGoals();
  });

  document.getElementById('yearly-goal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('yearly-goal-input');
    const content = input.value.trim();
    if (!content) return;

    const newGoal = {
      id: 'ygoal-' + Math.random().toString(36).substr(2, 9),
      year: currentYearStr,
      content,
      completed: false,
      createdAt: new Date().toISOString()
    };

    userData.yearlyGoals.push(newGoal);
    LocalDB.saveUserData(username, userData);
    
    input.value = '';
    renderGoals();
  });

  // Re-translate page on locale changes
  window.addEventListener('localeChanged', () => {
    LocaleManager.translateDOM();
    updateDateBadge();
    renderGoals();
  });

  // Initial loads
  updateDateBadge();
  updateMetrics();
  renderGoals();
  LocaleManager.translateDOM();
});
