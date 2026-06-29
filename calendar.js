/* ──────────────────────────────────────────── */
/* HabitFlow - Calendar & Notes Scripting       */
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
  let currentMonthDate = new Date();
  
  // Default selected date: today (local YYYY-MM-DD)
  const today = new Date();
  let selectedDateStr = today.toISOString().substring(0, 10);
  
  // Auto-save debounce timer
  let saveTimeout = null;

  // DOM elements
  const calendarMonthLabel = document.getElementById('calendar-current-month-lbl');
  const weekdaysRow = document.getElementById('calendar-weekdays-row');
  const daysGrid = document.getElementById('calendar-days-grid');
  
  const selectedDateLabel = document.getElementById('selected-date-display-label');
  const journalNotesTextarea = document.getElementById('journal-notes-textarea');
  const autosaveStatus = document.getElementById('autosave-status');
  const habitsCheckedList = document.getElementById('calendar-habits-checked-list');

  // Month navigation triggers
  document.getElementById('btn-cal-prev').addEventListener('click', () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('btn-cal-next').addEventListener('click', () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    renderCalendar();
  });

  // Textarea typing events -> debounced auto-save
  journalNotesTextarea.addEventListener('input', (e) => {
    // Show unsaved or typing state
    autosaveStatus.classList.add('opacity-0');

    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(() => {
      const content = e.target.value;
      if (!userData.notes) userData.notes = {};
      userData.notes[selectedDateStr] = content;
      LocalDB.saveUserData(username, userData);

      // Show auto-save success flash indicator
      autosaveStatus.classList.remove('opacity-0');
      setTimeout(() => {
        autosaveStatus.classList.add('opacity-0');
      }, 1500);
    }, 600);
  });

  // Render calendar elements
  function renderCalendar() {
    const locale = LocaleManager.get();
    const t = (p) => LocaleManager.t(p);
    
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    // 1. Set month name heading
    const monthNames = TRANSLATIONS[locale].months;
    calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;

    // 2. Render weekdays short headers
    const weekdaysShort = TRANSLATIONS[locale].weekdaysShort;
    weekdaysRow.innerHTML = '';
    weekdaysShort.forEach(wd => {
      weekdaysRow.innerHTML += `<div class="text-zinc-500 font-bold text-center">${wd[0]}</div>`;
    });

    // 3. Render days grid cells
    daysGrid.innerHTML = '';
    
    // First day of current month weekday index (0 = Sun, 1 = Mon, etc.)
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();

    // Days count in current month
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Empty offset padding cells
    for (let p = 0; p < startWeekday; p++) {
      daysGrid.innerHTML += `<div class="aspect-square"></div>`;
    }

    const todayStr = new Date().toISOString().substring(0, 10);

    // Days numbers loops
    for (let d = 1; d <= totalDays; d++) {
      const dayStr = d < 10 ? `0${d}` : `${d}`;
      const monthStr = (month + 1) < 10 ? `0${month + 1}` : `${month + 1}`;
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      // Check if date has completed logs
      const hasLogs = userData.logs.some(log => log.date === dateStr && log.completed);
      
      // Class matching states
      const isSelected = dateStr === selectedDateStr;
      const isToday = dateStr === todayStr;

      let borderClass = 'border border-transparent';
      if (isToday) {
        borderClass = 'border-2 border-accent/70 text-accent';
      }

      let activeClass = 'text-foreground/75 hover:bg-card-border/40';
      if (isSelected) {
        activeClass = 'bg-accent text-primary-foreground font-bold shadow-xs scale-105';
      }

      daysGrid.innerHTML += `
        <button id="cal-day-${d}" class="aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-semibold relative transition-all-custom cursor-pointer ${borderClass} ${activeClass}">
          <span>${d}</span>
          ${hasLogs ? `<div class="absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-accent'}"></div>` : ''}
        </button>
      `;
    }

    // Add click event triggers for days
    for (let d = 1; d <= totalDays; d++) {
      const dayStr = d < 10 ? `0${d}` : `${d}`;
      const monthStr = (month + 1) < 10 ? `0${month + 1}` : `${month + 1}`;
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      document.getElementById(`cal-day-${d}`).addEventListener('click', () => {
        selectedDateStr = dateStr;
        renderCalendar();
        loadDayDetails();
      });
    }
  }

  // Load journal and checked habits details of active date
  function loadDayDetails() {
    const locale = LocaleManager.get();
    const t = (p) => LocaleManager.t(p);

    // 1. Formatted selected date header label
    const dateObj = new Date(selectedDateStr + 'T00:00:00');
    const monthNames = TRANSLATIONS[locale].months;
    selectedDateLabel.textContent = `${dateObj.getDate()} ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

    // 2. Load daily notes
    journalNotesTextarea.value = (userData.notes && userData.notes[selectedDateStr]) || '';

    // 3. Load completed habits lists
    habitsCheckedList.innerHTML = '';
    const activeHabits = userData.habits.filter(h => !h.isArchived);
    
    // Checked logs on this day
    const completedList = activeHabits.filter(h => {
      return userData.logs.some(log => log.habitId === h.id && log.date === selectedDateStr && log.completed);
    });

    if (completedList.length === 0) {
      habitsCheckedList.innerHTML = `
        <div class="text-center py-6 text-foreground/45 text-xs font-medium">
          ${t('calendar.noHabitsLogged')}
        </div>
      `;
    } else {
      completedList.forEach(habit => {
        habitsCheckedList.innerHTML += `
          <div class="flex items-center gap-3 p-2.5 bg-background border border-card-border rounded-xl">
            <div class="w-4 h-4 rounded border border-accent bg-accent/20 flex items-center justify-center shrink-0">
              <i data-lucide="check" class="w-2.5 h-2.5 text-accent stroke-[3px]"></i>
            </div>
            <span class="text-xs font-semibold text-foreground/50 line-through truncate">${habit.name}</span>
          </div>
        `;
      });
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // Re-translate components on local switches
  window.addEventListener('localeChanged', () => {
    LocaleManager.translateDOM();
    renderCalendar();
    loadDayDetails();
  });

  // Initial runs
  renderCalendar();
  loadDayDetails();
  LocaleManager.translateDOM();
});
