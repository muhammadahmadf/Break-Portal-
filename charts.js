/* ============================================================
   charts.js — Analytics with Chart.js
   ============================================================ */

'use strict';

window.Charts = {
  _charts: {},

  render() {
    const container = document.getElementById('view-container');
    const now = new Date();

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Analytics</h2>
          <p>Visual insights into break patterns and violations</p>
        </div>
      </div>

      <!-- Top Stat Row -->
      <div class="stats-grid" style="margin-bottom:24px;">
        ${this._buildAnalyticStats()}
      </div>

      <!-- Charts Row 1 -->
      <div class="two-col" style="margin-bottom:20px;">
        <div class="section-card">
          <div class="section-header">
            <div class="section-title"><span class="title-icon">📊</span> Daily Breaks — Last 7 Days</div>
          </div>
          <div class="section-body">
            <div class="chart-container">
              <canvas id="chart-daily-breaks"></canvas>
            </div>
          </div>
        </div>

        <div class="section-card">
          <div class="section-header">
            <div class="section-title"><span class="title-icon">📈</span> Violations This Month</div>
          </div>
          <div class="section-body">
            <div class="chart-container">
              <canvas id="chart-violations"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Row 2 -->
      <div class="two-col" style="margin-bottom:20px;">
        <div class="section-card">
          <div class="section-header">
            <div class="section-title"><span class="title-icon">🍩</span> Break Duration Distribution</div>
          </div>
          <div class="section-body">
            <div class="chart-container" style="height:260px;">
              <canvas id="chart-duration-dist"></canvas>
            </div>
          </div>
        </div>

        <div class="section-card">
          <div class="section-header">
            <div class="section-title"><span class="title-icon">👥</span> Top Break Takers This Month</div>
          </div>
          <div class="section-body">
            <div class="chart-container" style="height:260px;">
              <canvas id="chart-top-employees"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Shift Type Breakdown -->
      <div class="section-card">
        <div class="section-header">
          <div class="section-title"><span class="title-icon">⏰</span> Average Break Duration by Employee (This Month)</div>
        </div>
        <div class="section-body">
          <div class="chart-container" style="height:280px;">
            <canvas id="chart-avg-break"></canvas>
          </div>
        </div>
      </div>`;

    // Render charts after DOM is ready
    setTimeout(() => {
      this._renderDailyBreaksChart();
      this._renderViolationsChart();
      this._renderDurationDistChart();
      this._renderTopEmployeesChart();
      this._renderAvgBreakChart();
    }, 50);
  },

  _buildAnalyticStats() {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const monthSessions = STATE.breakSessions.filter(s => {
      const d = new Date(s.startTime);
      return d.getMonth() === month && d.getFullYear() === year && s.status === 'completed';
    });
    const monthPenalties = STATE.penalties.filter(p => {
      const d = new Date(p.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const avgBreakMin = monthSessions.length > 0
      ? Math.round(monthSessions.reduce((a,s) => a + s.durationSeconds, 0) / monthSessions.length / 60)
      : 0;

    const compliantCount = STATE.employees.filter(emp => {
      return !monthPenalties.some(p => p.employeeId === emp.employeeId);
    }).length;

    return `
      <div class="stat-card cyan">
        <span class="stat-card-icon">📅</span>
        <div class="stat-card-value">${monthSessions.length}</div>
        <div class="stat-card-label">Breaks This Month</div>
      </div>
      <div class="stat-card green">
        <span class="stat-card-icon">⏱️</span>
        <div class="stat-card-value">${avgBreakMin}m</div>
        <div class="stat-card-label">Avg Break Duration</div>
      </div>
      <div class="stat-card pink">
        <span class="stat-card-icon">⚠️</span>
        <div class="stat-card-value">${monthPenalties.length}</div>
        <div class="stat-card-label">Violations This Month</div>
      </div>
      <div class="stat-card green">
        <span class="stat-card-icon">✅</span>
        <div class="stat-card-value">${compliantCount}</div>
        <div class="stat-card-label">Compliant Employees</div>
      </div>`;
  },

  _getChartDefaults() {
    return {
      plugins: {
        legend: {
          labels: { color: 'rgba(240,240,255,0.8)', font: { family: 'Outfit', size: 12 } }
        },
        tooltip: {
          backgroundColor: 'rgba(20,15,50,0.95)',
          borderColor: 'rgba(0,245,255,0.3)',
          borderWidth: 1,
          titleColor: '#00f5ff',
          bodyColor: 'rgba(240,240,255,0.85)',
          titleFont: { family: 'Outfit', weight: '700' },
          bodyFont: { family: 'Outfit' }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: 'rgba(240,240,255,0.6)', font: { family: 'Outfit', size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: 'rgba(240,240,255,0.6)', font: { family: 'Outfit', size: 11 } }
        }
      }
    };
  },

  _destroyChart(id) {
    if (this._charts[id]) {
      this._charts[id].destroy();
      delete this._charts[id];
    }
  },

  _renderDailyBreaksChart() {
    this._destroyChart('daily');
    const ctx = document.getElementById('chart-daily-breaks');
    if (!ctx) return;

    const labels = [];
    const breakCounts = [];
    const penaltyCounts = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      labels.push(d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));

      breakCounts.push(STATE.breakSessions.filter(s =>
        new Date(s.startTime).toDateString() === ds && s.status === 'completed'
      ).length);

      penaltyCounts.push(STATE.penalties.filter(p =>
        new Date(p.date).toDateString() === ds
      ).length);
    }

    this._charts['daily'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Breaks Taken',
            data: breakCounts,
            backgroundColor: 'rgba(0,245,255,0.2)',
            borderColor: '#00f5ff',
            borderWidth: 2,
            borderRadius: 6,
          },
          {
            label: 'Violations',
            data: penaltyCounts,
            backgroundColor: 'rgba(255,0,110,0.2)',
            borderColor: '#ff006e',
            borderWidth: 2,
            borderRadius: 6,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...this._getChartDefaults()
      }
    });
  },

  _renderViolationsChart() {
    this._destroyChart('violations');
    const ctx = document.getElementById('chart-violations');
    if (!ctx) return;

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const labels = Array.from({length: daysInMonth}, (_, i) => i + 1);
    const data = labels.map(day => {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      return STATE.penalties.filter(p => new Date(p.date).toDateString() === d.toDateString()).length;
    });

    // Cumulative
    const cumData = data.reduce((acc, v, i) => {
      acc.push((acc[i-1] || 0) + v);
      return acc;
    }, []);

    this._charts['violations'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.map(d => `${d}`),
        datasets: [
          {
            label: 'Daily Violations',
            data,
            backgroundColor: 'rgba(255,0,110,0.1)',
            borderColor: '#ff006e',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#ff006e',
            pointRadius: 3
          },
          {
            label: 'Cumulative',
            data: cumData,
            backgroundColor: 'transparent',
            borderColor: 'rgba(139,92,246,0.7)',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.4,
            pointRadius: 0,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...this._getChartDefaults(),
        scales: {
          ...this._getChartDefaults().scales,
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: 'rgba(139,92,246,0.8)', font: { family: 'Outfit', size: 11 } }
          }
        }
      }
    });
  },

  _renderDurationDistChart() {
    this._destroyChart('dist');
    const ctx = document.getElementById('chart-duration-dist');
    if (!ctx) return;

    const now = new Date();
    const sessions = STATE.breakSessions.filter(s => {
      const d = new Date(s.startTime);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && s.status === 'completed';
    });

    const buckets = {
      '< 10 min': 0,
      '10–20 min': 0,
      '20–30 min': 0,
      '30–40 min': 0,
      '> 40 min': 0
    };
    sessions.forEach(s => {
      const m = s.durationSeconds / 60;
      if (m < 10) buckets['< 10 min']++;
      else if (m < 20) buckets['10–20 min']++;
      else if (m < 30) buckets['20–30 min']++;
      else if (m < 40) buckets['30–40 min']++;
      else buckets['> 40 min']++;
    });

    this._charts['dist'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(buckets),
        datasets: [{
          data: Object.values(buckets),
          backgroundColor: [
            'rgba(0,245,255,0.7)',
            'rgba(16,185,129,0.7)',
            'rgba(245,158,11,0.7)',
            'rgba(139,92,246,0.7)',
            'rgba(255,0,110,0.7)'
          ],
          borderColor: 'rgba(10,10,30,0.5)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          ...this._getChartDefaults().plugins,
          legend: {
            position: 'right',
            labels: { color: 'rgba(240,240,255,0.8)', font: { family: 'Outfit', size: 11 }, padding: 12 }
          }
        }
      }
    });
  },

  _renderTopEmployeesChart() {
    this._destroyChart('top');
    const ctx = document.getElementById('chart-top-employees');
    if (!ctx) return;

    const now = new Date();
    const sessions = STATE.breakSessions.filter(s => {
      const d = new Date(s.startTime);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && s.status === 'completed';
    });

    const empBreaks = {};
    sessions.forEach(s => {
      empBreaks[s.employeeId] = (empBreaks[s.employeeId] || 0) + 1;
    });

    const sorted = Object.entries(empBreaks)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const labels = sorted.map(([id]) => getEmployee(id)?.name || id);
    const data = sorted.map(([, count]) => count);

    this._charts['top'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Breaks Taken',
          data,
          backgroundColor: labels.map((_, i) => `hsla(${200 + i * 25},80%,60%,0.5)`),
          borderColor: labels.map((_, i) => `hsla(${200 + i * 25},80%,70%,1)`),
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        ...this._getChartDefaults()
      }
    });
  },

  _renderAvgBreakChart() {
    this._destroyChart('avg');
    const ctx = document.getElementById('chart-avg-break');
    if (!ctx) return;

    const now = new Date();
    const sessions = STATE.breakSessions.filter(s => {
      const d = new Date(s.startTime);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && s.status === 'completed';
    });

    const empData = STATE.employees.filter(e => e.status === 'active').map(emp => {
      const empSessions = sessions.filter(s => s.employeeId === emp.employeeId);
      const avgSec = empSessions.length > 0
        ? empSessions.reduce((a, s) => a + s.durationSeconds, 0) / empSessions.length
        : 0;
      const quota = getBreakQuota(emp.shiftType);
      const avgAllowed = quota.reduce((a, b) => a + b.allowedMinutes * 60, 0) / quota.length;
      return { name: emp.name.split(' ')[0], avgMin: Math.round(avgSec / 60), allowedMin: Math.round(avgAllowed / 60) };
    }).filter(d => d.avgMin > 0);

    if (empData.length === 0) {
      ctx.parentElement.innerHTML = `<div class="empty-state" style="padding:40px;"><div class="empty-state-icon" style="font-size:40px;">📈</div><p>No break data this month yet.</p></div>`;
      return;
    }

    this._charts['avg'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: empData.map(d => d.name),
        datasets: [
          {
            label: 'Avg Break (min)',
            data: empData.map(d => d.avgMin),
            backgroundColor: 'rgba(0,245,255,0.3)',
            borderColor: '#00f5ff',
            borderWidth: 2,
            borderRadius: 6
          },
          {
            label: 'Allowed (min)',
            data: empData.map(d => d.allowedMin),
            backgroundColor: 'rgba(16,185,129,0.15)',
            borderColor: '#10b981',
            borderWidth: 2,
            borderDash: [4, 4],
            borderRadius: 6,
            type: 'line',
            tension: 0.4,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...this._getChartDefaults()
      }
    });
  }
};
