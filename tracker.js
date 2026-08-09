/* ──────────────────────────────────────────── */
/* HabitFlow - Tracker Scripting                */
/* ──────────────────────────────────────────── */

// Returns list of YYYY-MM-DD strings for a given month and year
function getDaysInMonth(year, month) {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    const dayNum = date.getDate();
    const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
    const monthNum = month + 1;
    const monthStr = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
    days.push(`${year}-${monthStr}-${dayStr}`);
    date.setDate(dayNum + 1);
  }
  return days;
}

document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  const username = Auth.getCurrentUser();
  if (!username) {
    Auth.checkAuth(true);
    return;
  }

  // Load theme & layout
  ThemeManager.load(username);
  UILayout.inject(username);

  // States
  let userData = LocalDB.getUserData(username);

  // Sync fresh data from Supabase
  CloudDB.loadFromServer().then(freshData => {
    if (freshData) {
      userData = freshData;
      renderGrid();
    }
  });
  let currentDate = new Date();
  let searchQuery = '';
  
  // Track editing elements
  let editingCategoryId = null;
  let editingCategoryName = '';
  let editingHabitId = null;
  let editingHabitName = '';
  
  // Track inputs per category for habit creations
  const newHabitInputs = {};

  // DOM Elements
  const searchInput = document.getElementById('tracker-search-input');
  const monthDisplay = document.getElementById('month-display-label');
  const gridTable = document.getElementById('tracker-grid-table');

  // Month navigation events
  document.getElementById('btn-prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderGrid();
  });
  document.getElementById('btn-next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderGrid();
  });

  // Search input events
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderGrid();
  });

  // Render Category Table
  function renderGrid() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed
    const days = getDaysInMonth(year, month);
    const todayStr = new Date().toISOString().substring(0, 10);
    const locale = LocaleManager.get();
    
    // Translation tags
    const t = (p) => LocaleManager.t(p);
    const monthNames = TRANSLATIONS[locale].months;
    const currentMonthDisplay = `${monthNames[month]} ${year}`;
    monthDisplay.textContent = currentMonthDisplay;

    // Filter categories & habits
    const filteredCategories = userData.categories.map(cat => {
      const habits = userData.habits.filter(h => h.categoryId === cat.id && !h.isArchived && h.name.toLowerCase().includes(searchQuery));
      // Sort habits: pinned first, then by order
      const sortedHabits = [...habits].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return a.order - b.order;
      });
      return { ...cat, habits: sortedHabits };
    }).filter(cat => cat.habits.length > 0 || searchQuery === '');

    // 1. Build Table Headers
    let headerHTML = `
      <thead>
        <tr class="border-b border-card-border bg-sidebar/50">
          <th class="sticky left-0 bg-card z-20 border-r border-card-border px-4 py-3 text-xs font-bold text-foreground/60 w-80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
            ${t('tracker.habitsAndProgress')}
          </th>
    `;

    days.forEach((dayStr, index) => {
      const dayNum = index + 1;
      const isToday = dayStr === todayStr;
      const dayOfWeekIndex = new Date(dayStr).getDay();
      const dayName = TRANSLATIONS[locale].weekdaysShort[dayOfWeekIndex];
      headerHTML += `
        <th class="px-1 py-2 text-center text-[10px] font-bold border-r border-card-border/50 min-w-10 w-12 ${
          isToday ? 'bg-accent/15 text-accent border-r-accent/30 border-l border-l-accent/30' : 'text-foreground/50'
        }">
          <div>${dayName}</div>
          <div class="text-xs mt-0.5">${dayNum}</div>
        </th>
      `;
    });
    headerHTML += `</tr></thead>`;

    // 2. Build Table Body
    let bodyHTML = `<tbody class="divide-y divide-card-border/50">`;

    filteredCategories.forEach((category, catIndex) => {
      // Category title row
      bodyHTML += `
        <tr class="bg-sidebar/40">
          <td class="sticky left-0 bg-card z-20 border-r border-card-border px-4 py-3 font-extrabold text-xs text-foreground/80 flex items-center justify-between group shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
      `;

      if (editingCategoryId === category.id) {
        bodyHTML += `
            <div class="flex items-center gap-1.5 w-full">
              <input type="text" id="edit-cat-input" value="${editingCategoryName}" 
                     class="bg-background border border-card-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-accent w-full font-medium"
                     onkeydown="if(event.key==='Enter') window.renameCategory('${category.id}')">
              <button onclick="window.renameCategory('${category.id}')" class="p-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded hover:bg-emerald-500/20 cursor-pointer">
                <i data-lucide="check" class="w-3 h-3"></i>
              </button>
            </div>
        `;
      } else {
        bodyHTML += `
            <span class="truncate max-w-40">${category.name}</span>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick="window.startEditCategory('${category.id}', '${category.name}')" class="p-1 hover:bg-card-border/40 rounded text-foreground/50 hover:text-foreground cursor-pointer" title="${t('common.edit')}">
                <i data-lucide="edit-2" class="w-3 h-3"></i>
              </button>
              <button onclick="window.reorderCategory(${catIndex}, 'up')" ${catIndex === 0 ? 'disabled' : ''} class="p-1 hover:bg-card-border/40 rounded text-foreground/50 hover:text-foreground cursor-pointer disabled:opacity-30">
                <i data-lucide="chevron-up" class="w-3 h-3"></i>
              </button>
              <button onclick="window.reorderCategory(${catIndex}, 'down')" ${catIndex === userData.categories.length - 1 ? 'disabled' : ''} class="p-1 hover:bg-card-border/40 rounded text-foreground/50 hover:text-foreground cursor-pointer disabled:opacity-30">
                <i data-lucide="chevron-down" class="w-3 h-3"></i>
              </button>
              <button onclick="window.deleteCategory('${category.id}')" class="p-1 hover:bg-rose-500/10 rounded text-foreground/50 hover:text-rose-500 cursor-pointer" title="${t('common.delete')}">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
              </button>
            </div>
        `;
      }

      bodyHTML += `
          </td>
          <td colSpan="${days.length}" class="px-4 py-2 border-r border-card-border/50 bg-card-border/10"></td>
        </tr>
      `;

      // Category Habits area
      const categoryHabits = category.habits || [];
      if (categoryHabits.length === 0) {
        // Seeding suggestions
        const presetList = [
          TRANSLATIONS[locale].presets.water,
          TRANSLATIONS[locale].presets.exercise,
          TRANSLATIONS[locale].presets.reading,
          TRANSLATIONS[locale].presets.meditation
        ];
        
        bodyHTML += `
          <tr class="bg-accent/3">
            <td class="sticky left-0 bg-card z-20 border-r border-card-border px-4 py-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
              <div class="flex flex-col gap-2">
                <span class="text-[11px] text-foreground/50 font-medium leading-tight">${t('tracker.emptyCategoryHint')}</span>
                <div class="flex flex-wrap gap-1.5">
        `;
        presetList.forEach(preset => {
          bodyHTML += `
            <button onclick="window.createHabit('${category.id}', '${preset}')" class="px-2 py-1 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1">
              <i data-lucide="plus" class="w-3 h-3"></i>
              <span>${preset}</span>
            </button>
          `;
        });
        bodyHTML += `
                </div>
              </div>
            </td>
            <td colSpan="${days.length}" class="px-4 py-2 border-r border-card-border/50 bg-card-border/5 text-center text-xs text-foreground/30 italic font-medium">
              ← ${t('tracker.addHabit')}
            </td>
          </tr>
        `;
      } else {
        // Render habits row
        categoryHabits.forEach((habit, habIndex) => {
          // Logs count for habit this month
          const habitLogs = userData.logs.filter(l => l.habitId === habit.id && l.date.startsWith(String(year) + '-' + String(month + 1).padStart(2, '0')));
          const completedCount = habitLogs.filter(l => l.completed).length;
          const percentage = days.length > 0 ? Math.round((completedCount / days.length) * 100) : 0;

          bodyHTML += `
            <tr class="hover:bg-sidebar/10 transition-colors">
              <td class="sticky left-0 bg-card z-20 border-r border-card-border px-4 py-2.5 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                <div class="flex flex-col gap-1 w-full group">
                  <div class="flex items-center justify-between min-w-0">
          `;

          if (editingHabitId === habit.id) {
            bodyHTML += `
                    <div class="flex items-center gap-1.5 w-full">
                      <input type="text" id="edit-habit-input" value="${editingHabitName}" 
                             class="bg-background border border-card-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-accent w-full font-medium"
                             onkeydown="if(event.key==='Enter') window.renameHabit('${habit.id}', '${category.id}')">
                      <button onclick="window.renameHabit('${habit.id}', '${category.id}')" class="p-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded hover:bg-emerald-500/20 cursor-pointer">
                        <i data-lucide="check" class="w-3 h-3"></i>
                      </button>
                    </div>
            `;
          } else {
            bodyHTML += `
                    <span class="text-xs font-semibold text-foreground/80 truncate pr-2">${habit.name}</span>
                    <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onclick="window.togglePinHabit('${habit.id}')" class="p-1 rounded cursor-pointer ${
                        habit.isPinned ? 'text-accent hover:bg-accent/10' : 'text-foreground/40 hover:text-foreground hover:bg-card-border/40'
                      }" title="${habit.isPinned ? t('tracker.unpin') : t('tracker.pin')}">
                        <i data-lucide="pin" class="w-3 h-3 fill-current"></i>
                      </button>
                      <button onclick="window.startEditHabit('${habit.id}', '${habit.name}')" class="p-1 hover:bg-card-border/40 rounded text-foreground/40 hover:text-foreground cursor-pointer">
                        <i data-lucide="edit-2" class="w-3 h-3"></i>
                      </button>
                      <button onclick="window.reorderHabit('${habit.id}', '${category.id}', ${habIndex}, 'up')" ${habIndex === 0 ? 'disabled' : ''} class="p-1 hover:bg-card-border/40 rounded text-foreground/45 disabled:opacity-30 cursor-pointer">
                        <i data-lucide="chevron-up" class="w-3 h-3"></i>
                      </button>
                      <button onclick="window.reorderHabit('${habit.id}', '${category.id}', ${habIndex}, 'down')" ${habIndex === categoryHabits.length - 1 ? 'disabled' : ''} class="p-1 hover:bg-card-border/40 rounded text-foreground/45 disabled:opacity-30 cursor-pointer">
                        <i data-lucide="chevron-down" class="w-3 h-3"></i>
                      </button>
                      <button onclick="window.deleteHabit('${habit.id}', '${category.id}')" class="p-1 hover:bg-rose-500/10 rounded text-foreground/40 hover:text-rose-500 cursor-pointer">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                      </button>
                    </div>
            `;
          }

          bodyHTML += `
                  </div>
                  <div class="flex items-center justify-between gap-2 mt-1">
                    <span class="text-[10px] text-foreground/40 font-bold shrink-0">
                      ${completedCount}/${days.length} (${percentage}%)
                    </span>
                    <div class="w-full bg-card-border/30 h-1 rounded-full overflow-hidden">
                      <div class="bg-accent h-full rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
                    </div>
                  </div>
                </div>
              </td>
          `;

          // Grid checkbox columns for each day
          days.forEach(dayStr => {
            const isChecked = userData.logs.some(l => l.habitId === habit.id && l.date === dayStr && l.completed);
            const isToday = dayStr === todayStr;

            bodyHTML += `
              <td class="p-0 border-r border-card-border/50 text-center transition-all ${isToday ? 'bg-accent/5 border-r-accent/20 border-l border-l-accent/20' : ''}">
                <button type="button" onclick="window.toggleDay('${habit.id}', '${dayStr}', ${isChecked})" class="w-full h-10 flex items-center justify-center border-0 outline-none transition-all cursor-pointer ${
                  isChecked ? 'text-accent bg-accent/8 font-bold' : 'hover:bg-card-border/30'
                }">
                  <div class="w-5 h-5 rounded-md flex items-center justify-center transition-all border ${
                    isChecked
                      ? 'border-accent bg-accent text-primary-foreground shadow-xs shadow-accent/20 scale-105'
                      : 'border-foreground/25 hover:border-foreground/50 bg-background/50'
                  }">
                    ${isChecked ? '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3px]"></i>' : ''}
                  </div>
                </button>
              </td>
            `;
          });

          bodyHTML += `</tr>`;
        });

        // Add Habit text field row at bottom of category list
        bodyHTML += `
          <tr>
            <td class="sticky left-0 bg-card z-20 border-r border-card-border px-4 py-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
              <div class="flex items-center gap-1">
                <input type="text" id="new-habit-for-${category.id}" placeholder="${t('tracker.addHabit')}" 
                       value="${newHabitInputs[category.id] || ''}"
                       oninput="window.setNewHabitValue('${category.id}', this.value)"
                       onkeydown="if(event.key==='Enter') window.createHabit('${category.id}')"
                       class="bg-transparent text-xs w-full py-1 outline-none font-medium placeholder:text-foreground/35 focus:placeholder:text-foreground/20">
                <button onclick="window.createHabit('${category.id}')" class="p-1 hover:bg-card-border/40 rounded text-foreground/50 hover:text-foreground cursor-pointer">
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </td>
            <td colSpan="${days.length}" class="px-4 py-2 border-r border-card-border/50 bg-card-border/5"></td>
          </tr>
        `;
      }
    });

    // Add category inputs row at the bottom of the table
    bodyHTML += `
      <tr>
        <td class="sticky left-0 bg-card z-20 border-r border-card-border px-4 py-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
          <div class="flex items-center gap-2">
            <i data-lucide="folder-plus" class="w-4 h-4 text-foreground/45"></i>
            <input type="text" id="new-category-input" placeholder="${t('tracker.addCategory')}"
                   class="bg-transparent text-xs font-semibold w-full outline-none placeholder:text-foreground/40 focus:placeholder:text-foreground/20"
                   onkeydown="if(event.key==='Enter') window.createCategory()">
            <button onclick="window.createCategory()" class="p-1 hover:bg-card-border/40 rounded text-foreground/50 hover:text-foreground cursor-pointer">
              <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
        <td colSpan="${days.length}" class="px-4 py-2 border-r border-card-border/50 bg-card-border/5"></td>
      </tr>
    `;

    bodyHTML += `</tbody>`;

    gridTable.innerHTML = headerHTML + bodyHTML;

    // Auto focus edit inputs
    const editCat = document.getElementById('edit-cat-input');
    if (editCat) editCat.focus();
    const editHab = document.getElementById('edit-habit-input');
    if (editHab) editHab.focus();

    if (window.lucide) window.lucide.createIcons();
  }

  // Window exports for HTML onclick handlers
  window.setNewHabitValue = (catId, val) => {
    newHabitInputs[catId] = val;
  };

  // Toggle habit check log
  window.toggleDay = (habitId, date, isChecked) => {
    const existingIndex = userData.logs.findIndex(l => l.habitId === habitId && l.date === date);
    if (existingIndex > -1) {
      if (isChecked) {
        // Toggle off
        userData.logs.splice(existingIndex, 1);
      } else {
        userData.logs[existingIndex].completed = true;
      }
    } else {
      // Toggle on
      userData.logs.push({
        id: 'log-' + Math.random().toString(36).substr(2, 9),
        habitId,
        date,
        completed: true,
        createdAt: new Date().toISOString()
      });
    }
    LocalDB.saveUserData(username, userData);
    renderGrid();
  };

  // Category CRUD
  window.createCategory = () => {
    const input = document.getElementById('new-category-input');
    const name = input.value.trim();
    if (!name) return;

    const newCat = {
      id: 'cat-' + Math.random().toString(36).substr(2, 9),
      name,
      order: userData.categories.length
    };

    userData.categories.push(newCat);
    LocalDB.saveUserData(username, userData);
    input.value = '';
    renderGrid();
  };

  window.startEditCategory = (id, name) => {
    editingCategoryId = id;
    editingCategoryName = name;
    renderGrid();
  };

  window.renameCategory = (id) => {
    const val = document.getElementById('edit-cat-input').value.trim();
    if (!val) return;

    userData.categories = userData.categories.map(c => c.id === id ? { ...c, name: val } : c);
    LocalDB.saveUserData(username, userData);
    editingCategoryId = null;
    renderGrid();
  };

  window.deleteCategory = (id) => {
    const locale = LocaleManager.get();
    if (!confirm(TRANSLATIONS[locale].tracker.confirmDeleteCategory)) return;

    userData.categories = userData.categories.filter(c => c.id !== id);
    // Delete related habits and logs
    const relatedHabits = userData.habits.filter(h => h.categoryId === id);
    userData.habits = userData.habits.filter(h => h.categoryId !== id);
    
    const relatedHabitIds = relatedHabits.map(h => h.id);
    userData.logs = userData.logs.filter(l => !relatedHabitIds.includes(l.habitId));

    LocalDB.saveUserData(username, userData);
    renderGrid();
  };

  window.reorderCategory = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= userData.categories.length) return;

    const temp = userData.categories[index];
    userData.categories[index] = userData.categories[targetIndex];
    userData.categories[targetIndex] = temp;

    // Reset orders
    userData.categories.forEach((cat, idx) => {
      cat.order = idx;
    });

    LocalDB.saveUserData(username, userData);
    renderGrid();
  };

  // Habit CRUD
  window.createHabit = (categoryId, presetName = null) => {
    let name = presetName;
    if (!name) {
      const input = document.getElementById(`new-habit-for-${categoryId}`);
      name = input ? input.value.trim() : '';
    }
    if (!name) return;

    const newHabit = {
      id: 'h-' + Math.random().toString(36).substr(2, 9),
      categoryId,
      name,
      order: userData.habits.filter(h => h.categoryId === categoryId).length,
      isPinned: false,
      isArchived: false,
      createdAt: new Date().toISOString()
    };

    userData.habits.push(newHabit);
    LocalDB.saveUserData(username, userData);
    
    // Clear input
    newHabitInputs[categoryId] = '';
    renderGrid();
  };

  window.startEditHabit = (id, name) => {
    editingHabitId = id;
    editingHabitName = name;
    renderGrid();
  };

  window.renameHabit = (id, categoryId) => {
    const val = document.getElementById('edit-habit-input').value.trim();
    if (!val) return;

    userData.habits = userData.habits.map(h => h.id === id ? { ...h, name: val } : h);
    LocalDB.saveUserData(username, userData);
    editingHabitId = null;
    renderGrid();
  };

  window.togglePinHabit = (id) => {
    userData.habits = userData.habits.map(h => h.id === id ? { ...h, isPinned: !h.isPinned } : h);
    LocalDB.saveUserData(username, userData);
    renderGrid();
  };

  window.deleteHabit = (id, categoryId) => {
    const locale = LocaleManager.get();
    if (!confirm(TRANSLATIONS[locale].tracker.confirmDeleteHabit)) return;

    userData.habits = userData.habits.filter(h => h.id !== id);
    userData.logs = userData.logs.filter(l => l.habitId !== id);

    LocalDB.saveUserData(username, userData);
    renderGrid();
  };

  window.reorderHabit = (id, categoryId, index, direction) => {
    const categoryHabits = userData.habits.filter(h => h.categoryId === categoryId && !h.isArchived);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categoryHabits.length) return;

    // Swap orders
    const habitA = categoryHabits[index];
    const habitB = categoryHabits[targetIndex];
    
    const tempOrder = habitA.order;
    habitA.order = habitB.order;
    habitB.order = tempOrder;

    // Save updated arrays
    userData.habits = userData.habits.map(h => {
      if (h.id === habitA.id) return habitA;
      if (h.id === habitB.id) return habitB;
      return h;
    });

    LocalDB.saveUserData(username, userData);
    renderGrid();
  };

  // Locale changes
  window.addEventListener('localeChanged', () => {
    LocaleManager.translateDOM();
    renderGrid();
  });

  // Initial draw
  renderGrid();
  LocaleManager.translateDOM();
});
