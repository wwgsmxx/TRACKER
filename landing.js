/* ──────────────────────────────────────────── */
/* HabitFlow - Landing Page Scripting           */
/* ──────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Check auth first
  if (!Auth.checkAuth(false)) return;

  // Initialize copyright year
  document.getElementById('current-year').textContent = new Date().getFullYear();

  // Active preview tab state
  let activePreviewIndex = 0;

  // Draw features list
  function renderFeatures() {
    const locale = LocaleManager.get();
    const items = TRANSLATIONS[locale].landing.features.items;
    const grid = document.getElementById('features-grid');
    grid.innerHTML = '';

    items.forEach((item, index) => {
      grid.innerHTML += `
        <div class="group relative bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/30 rounded-2xl p-6 transition-all cursor-default overflow-hidden">
          <div class="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/3 rounded-2xl transition-all"></div>
          <div class="relative">
            <div class="text-3xl mb-4">${item.icon}</div>
            <h3 class="text-white font-bold text-base mb-2">${item.title}</h3>
            <p class="text-zinc-500 text-sm leading-relaxed font-medium">${item.desc}</p>
          </div>
        </div>
      `;
    });
  }

  // Draw Preview Tabs switcher
  function renderPreviewTabs() {
    const locale = LocaleManager.get();
    const tabNames = TRANSLATIONS[locale].landing.preview.screens;
    const tabIcons = ['layout-dashboard', 'check-square', 'bar-chart-3', 'calendar'];
    const tabsContainer = document.getElementById('preview-tabs');
    tabsContainer.innerHTML = '';

    tabNames.forEach((name, index) => {
      const isActive = activePreviewIndex === index;
      tabsContainer.innerHTML += `
        <button id="preview-tab-${index}" class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
          isActive 
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' 
            : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
        }">
          <i data-lucide="${tabIcons[index]}" class="w-3.5 h-3.5"></i>
          <span>${name}</span>
        </button>
      `;
    });

    // Add click events
    tabNames.forEach((_, index) => {
      document.getElementById(`preview-tab-${index}`).addEventListener('click', () => {
        activePreviewIndex = index;
        renderPreviewTabs();
        renderActivePreview();
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // Generate preview templates
  function getDashboardPreviewHTML() {
    const locale = LocaleManager.get();
    const t = TRANSLATIONS[locale].dashboard;
    
    return `
      <div class="w-full bg-[#09090b] rounded-xl p-4 border border-zinc-800 text-[11px] space-y-3 shadow-2xl">
        <div class="flex items-center justify-between mb-1">
          <span class="font-bold text-white text-sm">Dashboard</span>
          <span class="text-zinc-500 text-[10px]">Jun 2026</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
            <div class="text-zinc-500 text-[9px] font-bold uppercase tracking-wide mb-1">${t.todayProgress}</div>
            <div class="text-white font-extrabold text-sm">7 / 10</div>
            <div class="text-zinc-600 text-[9px] font-medium mt-0.5">70% completed</div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
            <div class="text-zinc-500 text-[9px] font-bold uppercase tracking-wide mb-1">${t.currentStreak}</div>
            <div class="text-white font-extrabold text-sm">12 days</div>
            <div class="text-zinc-600 text-[9px] font-medium mt-0.5">${t.keepItGoing}</div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
            <div class="text-zinc-500 text-[9px] font-bold uppercase tracking-wide mb-1">${t.bestStreak}</div>
            <div class="text-white font-extrabold text-sm">21 days</div>
            <div class="text-zinc-600 text-[9px] font-medium mt-0.5">${t.absoluteRecord}</div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
            <div class="text-zinc-500 text-[9px] font-bold uppercase tracking-wide mb-1">${t.totalCheckmarks}</div>
            <div class="text-white font-extrabold text-sm">248</div>
            <div class="text-zinc-600 text-[9px] font-medium mt-0.5">This year</div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-zinc-300 font-bold text-[10px]">${t.monthlyGoals}</span>
              <span class="text-[8px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">June</span>
            </div>
            <div class="space-y-1">
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 rounded border border-emerald-500 bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <i data-lucide="check" class="w-2.5 h-2.5 text-emerald-400"></i>
                </div>
                <span class="text-[9px] font-medium line-through text-zinc-600">Read 4 books</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 rounded border border-zinc-700 flex items-center justify-center flex-shrink-0"></div>
                <span class="text-[9px] font-medium text-zinc-400">Exercise 20 days</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 rounded border border-zinc-700 flex items-center justify-center flex-shrink-0"></div>
                <span class="text-[9px] font-medium text-zinc-400">Learn Spanish</span>
              </div>
            </div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-zinc-300 font-bold text-[10px]">${t.yearlyGoals}</span>
              <span class="text-[8px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">2026</span>
            </div>
            <div class="space-y-1">
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 rounded border border-emerald-500 bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <i data-lucide="check" class="w-2.5 h-2.5 text-emerald-400"></i>
                </div>
                <span class="text-[9px] font-medium line-through text-zinc-600">Run a marathon</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 rounded border border-zinc-700 flex items-center justify-center flex-shrink-0"></div>
                <span class="text-[9px] font-medium text-zinc-400">Save $5000</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 rounded border border-zinc-700 flex items-center justify-center flex-shrink-0"></div>
                <span class="text-[9px] font-medium text-zinc-400">Launch a project</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function getTrackerPreviewHTML() {
    const days = Array.from({ length: 15 }, (_, i) => i + 1);
    const habits = [
      { name: 'Drink Water 💧', checks: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14] },
      { name: 'Exercise 🏋️', checks: [1, 3, 5, 7, 9, 11, 13, 15] },
      { name: 'Read Book 📚', checks: [1, 2, 3, 4, 6, 8, 9, 10, 12, 14] },
      { name: 'Meditation 🧘', checks: [2, 4, 6, 8, 10, 12] },
    ];

    let headers = '';
    days.forEach(d => {
      headers += `<th class="px-1 py-2 text-center font-bold min-w-[20px] ${d === 15 ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-600'}">${d}</th>`;
    });

    let rows = '';
    habits.forEach(habit => {
      let cells = '';
      days.forEach(d => {
        const checked = habit.checks.includes(d);
        cells += `
          <td class="px-0.5 py-1 text-center ${d === 15 ? 'bg-emerald-500/5' : ''}">
            <div class="w-4 h-4 mx-auto rounded-sm border flex items-center justify-center ${
              checked ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-700'
            }">
              ${checked ? '<i data-lucide="check" class="w-2.5 h-2.5 text-white"></i>' : ''}
            </div>
          </td>
        `;
      });

      const percentage = Math.round((habit.checks.length / days.length) * 100);
      rows += `
        <tr class="border-b border-zinc-800/50">
          <td class="sticky left-0 bg-[#09090b] px-3 py-1.5">
            <div class="text-zinc-300 font-semibold text-[9px] truncate w-24">${habit.name}</div>
            <div class="w-full bg-zinc-800 h-0.5 rounded-full mt-1 overflow-hidden">
              <div class="bg-emerald-500 h-full rounded-full" style="width: ${percentage}%"></div>
            </div>
          </td>
          ${cells}
        </tr>
      `;
    });

    return `
      <div class="w-full bg-[#09090b] rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
          <span class="font-bold text-white text-sm">Habit Tracker</span>
          <span class="text-zinc-500 text-[10px] font-semibold">June 2026</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-[9px]">
            <thead>
              <tr class="border-b border-zinc-800">
                <th class="sticky left-0 bg-[#09090b] text-left px-3 py-2 text-zinc-500 font-bold w-28">Habit</th>
                ${headers}
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function getStatsPreviewHTML() {
    const locale = LocaleManager.get();
    const t = TRANSLATIONS[locale].statistics;

    // Generate heatmap cells
    const heatData = Array.from({ length: 40 * 7 }, (_, i) => {
      const rand = Math.random();
      return rand > 0.5 ? (rand > 0.8 ? 3 : rand > 0.65 ? 2 : 1) : 0;
    });

    const weeks = [];
    for (let w = 0; w < 40; w++) {
      weeks.push(heatData.slice(w * 7, w * 7 + 7));
    }

    const getColor = (v) => {
      if (v === 0) return 'bg-zinc-800/60';
      if (v === 1) return 'bg-emerald-500/30';
      if (v === 2) return 'bg-emerald-500/60';
      return 'bg-emerald-500';
    };

    let heatmapHTML = '';
    weeks.forEach(week => {
      let cells = '';
      week.forEach(val => {
        cells += `<div class="w-2 h-2 rounded-[2px] ${getColor(val)}"></div>`;
      });
      heatmapHTML += `<div class="flex flex-col gap-[2px]">${cells}</div>`;
    });

    return `
      <div class="w-full bg-[#09090b] rounded-xl border border-zinc-800 shadow-2xl overflow-hidden text-[10px]">
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
          <span class="font-bold text-white text-sm">${t.title}</span>
          <span class="text-zinc-500 text-[10px] font-semibold">Last 365 days</span>
        </div>
        <div class="p-4 space-y-3">
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
              <div class="text-zinc-500 text-[8px] font-bold uppercase tracking-wide">${t.activeHabits}</div>
              <div class="text-white font-extrabold text-xs mt-0.5">12</div>
            </div>
            <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
              <div class="text-zinc-500 text-[8px] font-bold uppercase tracking-wide">${t.totalLogs}</div>
              <div class="text-white font-extrabold text-xs mt-0.5">348</div>
            </div>
            <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
              <div class="text-zinc-500 text-[8px] font-bold uppercase tracking-wide">Best Streak</div>
              <div class="text-white font-extrabold text-xs mt-0.5">21 days</div>
            </div>
          </div>
          <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
            <div class="text-zinc-500 text-[9px] font-bold mb-2">${t.completionHistory}</div>
            <div class="flex gap-[2px] overflow-x-auto pb-1">
              ${heatmapHTML}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function getCalendarPreviewHTML() {
    const locale = LocaleManager.get();
    const t = TRANSLATIONS[locale].calendar;
    const days = Array.from({ length: 30 }, (_, i) => i + 1);
    const completedDays = [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 29, 30];

    const weekdaysShort = TRANSLATIONS[locale].weekdaysShort;
    let weekdaysHTML = '';
    weekdaysShort.forEach(wd => {
      weekdaysHTML += `<div class="text-zinc-600 text-[8px] font-bold text-center">${wd[0]}</div>`;
    });

    let calendarDaysHTML = '';
    // Empty paddings for calendar
    for (let p = 0; p < 6; p++) {
      calendarDaysHTML += `<div class="aspect-square"></div>`;
    }
    days.forEach(d => {
      const comp = completedDays.includes(d);
      const isSelected = d === 15;
      calendarDaysHTML += `
        <div class="aspect-square rounded-md flex items-center justify-center text-[8px] font-bold relative ${
          isSelected ? 'border border-emerald-500 text-emerald-400' : 'text-zinc-500'
        }">
          ${d}
          ${comp ? '<div class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500"></div>' : ''}
        </div>
      `;
    });

    return `
      <div class="w-full bg-[#09090b] rounded-xl border border-zinc-800 shadow-2xl overflow-hidden text-[10px]">
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
          <span class="font-bold text-white text-sm">${t.title}</span>
          <span class="text-zinc-500 text-[10px] font-semibold">June 2026</span>
        </div>
        <div class="p-3 grid grid-cols-2 gap-3">
          <div>
            <div class="grid grid-cols-7 gap-1 mb-1">
              ${weekdaysHTML}
            </div>
            <div class="grid grid-cols-7 gap-1">
              ${calendarDaysHTML}
            </div>
          </div>
          <div class="space-y-2">
            <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
              <div class="text-zinc-500 text-[8px] font-bold mb-1.5">15 June — Habits</div>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <div class="w-3 h-3 rounded border border-emerald-500 bg-emerald-500/20 flex items-center justify-center">
                    <i data-lucide="check" class="w-2 h-2 text-emerald-400"></i>
                  </div>
                  <span class="text-[8px] font-medium line-through text-zinc-600">Drink Water</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <div class="w-3 h-3 rounded border border-emerald-500 bg-emerald-500/20 flex items-center justify-center">
                    <i data-lucide="check" class="w-2 h-2 text-emerald-400"></i>
                  </div>
                  <span class="text-[8px] font-medium line-through text-zinc-600">Exercise</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <div class="w-3 h-3 rounded border border-zinc-700 flex items-center justify-center"></div>
                  <span class="text-[8px] font-medium text-zinc-400">Read Book</span>
                </div>
              </div>
            </div>
            <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
              <div class="text-zinc-500 text-[8px] font-bold mb-1">${t.dailyNotes}</div>
              <div class="text-zinc-500 text-[8px] leading-relaxed">Great workout today! Feeling energized and ready for the rest of the week...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Draw active tab preview contents
  function renderActivePreview() {
    const urls = ['dashboard', 'tracker', 'statistics', 'calendar'];
    document.getElementById('preview-url-bar').textContent = `habitflow.app/${urls[activePreviewIndex]}`;

    const viewport = document.getElementById('preview-viewport');
    if (activePreviewIndex === 0) {
      viewport.innerHTML = getDashboardPreviewHTML();
    } else if (activePreviewIndex === 1) {
      viewport.innerHTML = getTrackerPreviewHTML();
    } else if (activePreviewIndex === 2) {
      viewport.innerHTML = getStatsPreviewHTML();
    } else if (activePreviewIndex === 3) {
      viewport.innerHTML = getCalendarPreviewHTML();
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // Handle local state and elements for active locale
  function translatePage() {
    const locale = LocaleManager.get();
    
    // Set headers
    LocaleManager.translateDOM();

    // Toggle active state for language switcher buttons
    const activeClass = 'bg-emerald-500 text-white shadow-sm';
    const inactiveClass = 'text-zinc-400 hover:text-white';
    
    const enBtn = document.getElementById('lang-btn-en');
    const kkBtn = document.getElementById('lang-btn-kk');
    const footerEnBtn = document.getElementById('footer-lang-en');
    const footerKkBtn = document.getElementById('footer-lang-kk');

    if (locale === 'en') {
      enBtn.className = `px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${activeClass}`;
      kkBtn.className = `px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${inactiveClass}`;
      footerEnBtn.className = `px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${activeClass}`;
      footerKkBtn.className = `px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${inactiveClass}`;
    } else {
      enBtn.className = `px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${inactiveClass}`;
      kkBtn.className = `px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${activeClass}`;
      footerEnBtn.className = `px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${inactiveClass}`;
      footerKkBtn.className = `px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${activeClass}`;
    }

    // Static text values in stats block
    const statText = {
      en: { colors: 'Theme Colors', habits: 'Habits to Track', history: 'Day History', langs: 'Languages' },
      kk: { colors: 'Тақырып түстері', habits: 'Әдеттер саны', history: 'Күн тарихы', langs: 'Тілдер' }
    };
    document.getElementById('stat-theme-colors').textContent = statText[locale].colors;
    document.getElementById('stat-habits').textContent = statText[locale].habits;
    document.getElementById('stat-history').textContent = statText[locale].history;
    document.getElementById('stat-languages').textContent = statText[locale].langs;

    // Redraw lists
    renderFeatures();
    renderPreviewTabs();
    renderActivePreview();
  }

  // Listen to language changes
  window.addEventListener('localeChanged', translatePage);

  // Setup landing hero animation preview
  const heroPreview = document.getElementById('hero-preview-container');
  heroPreview.innerHTML = getDashboardPreviewHTML();

  // Trigger first render
  translatePage();
});
