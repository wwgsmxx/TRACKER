/* ──────────────────────────────────────────── */
/* HabitFlow - Statistics Scripting             */
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
  const userData = LocalDB.getUserData(username);
  const todayStr = new Date().toISOString().substring(0, 10);
  const currentYear = new Date().getFullYear();
  
  // Set current year label
  document.getElementById('stat-current-year').textContent = String(currentYear);

  // Chart instances placeholders
  let lineChartInstance = null;
  let barChartInstance = null;

  // Calculate values
  const habits = userData.habits.filter(h => !h.isArchived);
  const totalHabitsCount = habits.length;

  // Gather logs mapping
  const logsCountByDate = {};
  const habitLogsMap = {};

  habits.forEach(habit => {
    habitLogsMap[habit.id] = [];
    userData.logs.forEach(log => {
      if (log.habitId === habit.id && log.completed) {
        logsCountByDate[log.date] = (logsCountByDate[log.date] || 0) + 1;
        habitLogsMap[habit.id].push(log.date);
      }
    });
  });

  const uniqueLogDates = Object.keys(logsCountByDate);
  const totalCheckmarks = uniqueLogDates.reduce((acc, date) => acc + (logsCountByDate[date] || 0), 0);

  // 1. Render Metrics Counters
  document.getElementById('stat-active-habits-val').textContent = String(totalHabitsCount);
  document.getElementById('stat-total-checkmarks-val').textContent = String(totalCheckmarks);

  // Calculate most consistent habit
  let mostConsistentHabit = '-';
  let maxStreak = 0;
  habits.forEach(habit => {
    const streak = calculateStreak(habitLogsMap[habit.id] || [], todayStr);
    if (streak.best > maxStreak) {
      maxStreak = streak.best;
      mostConsistentHabit = habit.name;
    }
  });
  document.getElementById('stat-streak-habit-name').textContent = mostConsistentHabit;
  document.getElementById('stat-streak-days-val').textContent = String(maxStreak);

  // 2. Render GitHub Activity Heatmap
  function renderHeatmap() {
    const heatmapContainer = document.getElementById('heatmap-container');
    heatmapContainer.innerHTML = '';

    const heatmapDays = [];
    const startHeatmapDate = new Date();
    startHeatmapDate.setDate(startHeatmapDate.getDate() - 364);

    for (let i = 0; i < 365; i++) {
      const tempDate = new Date(startHeatmapDate);
      tempDate.setDate(tempDate.getDate() + i);
      const dateStr = tempDate.toISOString().substring(0, 10);
      heatmapDays.push({
        date: dateStr,
        count: logsCountByDate[dateStr] || 0,
        dayOfWeek: tempDate.getDay(),
      });
    }

    const weeks = [];
    let currentWeek = [];

    heatmapDays.forEach((day, index) => {
      currentWeek.push(day);
      if (day.dayOfWeek === 6 || index === heatmapDays.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    const getHeatmapColorClass = (count) => {
      if (count === 0) return 'bg-card-border/30 dark:bg-zinc-800/40';
      if (count <= 2) return 'bg-accent/30';
      if (count <= 4) return 'bg-accent/60';
      return 'bg-accent shadow-xs shadow-accent/20';
    };

    weeks.forEach((week) => {
      let cellsHTML = '';
      week.forEach((day) => {
        cellsHTML += `
          <div title="${day.date}: ${day.count}"
               class="w-3 h-3 rounded-[2px] transition-all hover:scale-125 hover:z-10 ${getHeatmapColorClass(day.count)}">
          </div>
        `;
      });
      heatmapContainer.innerHTML += `<div class="flex flex-col gap-[3px]">${cellsHTML}</div>`;
    });
  }

  // 3. Render Chart.js Graph Boards
  function drawCharts() {
    const locale = LocaleManager.get();
    
    // Fetch accent colors dynamically
    const style = getComputedStyle(document.documentElement);
    const accentColor = style.getPropertyValue('--accent').trim() || '#10b981';

    // A. 7-Day Completion Rate Line Chart
    const past7DaysData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().substring(0, 10);
      const completedCount = logsCountByDate[dateStr] || 0;
      const rate = totalHabitsCount > 0 ? Math.round((completedCount / totalHabitsCount) * 100) : 0;
      const dayIndex = d.getDay();
      return {
        date: TRANSLATIONS[locale].weekdaysShort[dayIndex],
        rate
      };
    });

    const lineCtx = document.getElementById('line-chart-canvas').getContext('2d');
    if (lineChartInstance) lineChartInstance.destroy();
    
    lineChartInstance = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: past7DaysData.map(d => d.date),
        datasets: [{
          label: 'Rate (%)',
          data: past7DaysData.map(d => d.rate),
          borderColor: accentColor,
          backgroundColor: accentColor + '10',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: accentColor,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#888888', font: { size: 10 } } },
          y: { min: 0, max: 100, ticks: { callback: value => value + '%', color: '#888888', font: { size: 10 } } }
        }
      }
    });

    // B. 12-Month Completion Bar Chart
    const monthNames = TRANSLATIONS[locale].months;
    const monthlyRates = monthNames.map((monthName, index) => {
      const monthPrefix = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
      const totalDays = new Date(currentYear, index + 1, 0).getDate();
      const possibleChecksCount = totalDays * totalHabitsCount;

      let actualChecksCount = 0;
      habits.forEach(habit => {
        userData.logs.forEach(log => {
          if (log.habitId === habit.id && log.completed && log.date.startsWith(monthPrefix)) {
            actualChecksCount++;
          }
        });
      });

      const completionRate = possibleChecksCount > 0 
        ? Math.round((actualChecksCount / possibleChecksCount) * 100) 
        : 0;

      return {
        name: monthName.substring(0, 3),
        rate: completionRate
      };
    });

    const barCtx = document.getElementById('bar-chart-canvas').getContext('2d');
    if (barChartInstance) barChartInstance.destroy();

    barChartInstance = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: monthlyRates.map(m => m.name),
        datasets: [{
          data: monthlyRates.map(m => m.rate),
          backgroundColor: accentColor,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#888888', font: { size: 10 } } },
          y: { min: 0, max: 100, ticks: { callback: value => value + '%', color: '#888888', font: { size: 10 } } }
        }
      }
    });
  }

  // 4. Exports controls
  // CSV Export
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    let csvContent = 'data:text/csv;charset=utf-8,Category,Habit,Date,Completed\n';

    userData.categories.forEach(cat => {
      const catHabits = userData.habits.filter(h => h.categoryId === cat.id);
      catHabits.forEach(h => {
        const hLogs = userData.logs.filter(l => l.habitId === h.id);
        hLogs.forEach(log => {
          csvContent += `"${cat.name}","${h.name}","${log.date}",${log.completed ? 'Yes' : 'No'}\n`;
        });
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `habit_tracker_stats_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // PDF print
  document.getElementById('btn-print-pdf').addEventListener('click', () => {
    window.print();
  });

  // Translate page on switches
  window.addEventListener('localeChanged', () => {
    LocaleManager.translateDOM();
    renderHeatmap();
    drawCharts();
  });

  // Initial render calls
  renderHeatmap();
  drawCharts();
  LocaleManager.translateDOM();
});
