/* ============================================================
   dashboard.js — Live Admin Dashboard
   ============================================================ */

'use strict';

window.Dashboard = {
  render() {
    const container = document.getElementById('view-container');
    const isEmployee = STATE.currentUser?.role === 'employee';

    if (isEmployee) {
      this._renderEmployeeDashboard(container);
    } else {
      this._renderAdminDashboard(container);
    }
  },

  _renderAdminDashboard(container) {
    const today = new Date().toDateString();
    const active = getActiveSessions();
    const todayPen = getTodayPenalties();
    const totalFines = STATE.penalties.reduce((a, p) => a + p.amount, 0);
    const todayFines = todayPen.reduce((a, p) => a + p.amount, 0);
    const todaySessions = STATE.breakSessions.filter(s => new Date(s.startTime).toDateString() === today);
    const activeEmployees = STATE.employees.filter(e => e.status === 'active').length;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Dashboard</h2>
          <p>${new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('breaks')">⏸️ Go to Break Tracker</button>
          <button class="btn btn-primary btn-sm" onclick="Reports.quickExport()">📊 Quick Export</button>
        </div>
      </div>

      <!-- Alert Banner -->
      <div id="dashboard-alerts"></div>

      <!-- Summary Cards -->
      <div class="stats-grid" id="stats-grid">
        <div class="stat-card cyan">
          <span class="stat-card-icon">👥</span>
          <div class="stat-card-value">${activeEmployees}</div>
          <div class="stat-card-label">Active Employees</div>
          <div class="stat-card-sub">${STATE.employees.length} total registered</div>
        </div>
        <div class="stat-card green">
          <span class="stat-card-icon">⏸️</span>
          <div class="stat-card-value" id="stat-active">${active.length}</div>
          <div class="stat-card-label">Currently on Break</div>
          <div class="stat-card-sub" id="stat-active-sub">${todaySessions.length} breaks taken today</div>
        </div>
        <div class="stat-card pink">
          <span class="stat-card-icon">⚠️</span>
          <div class="stat-card-value" id="stat-violations">${todayPen.length}</div>
          <div class="stat-card-label">Violations Today</div>
          <div class="stat-card-sub" id="stat-violations-sub">Total: ${STATE.penalties.length} all time</div>
        </div>
        <div class="stat-card purple">
          <span class="stat-card-icon">💰</span>
          <div class="stat-card-value" id="stat-fines">${formatCurrency(todayFines)}</div>
          <div class="stat-card-label">Fines Today</div>
          <div class="stat-card-sub" id="stat-fines-sub">Total: ${formatCurrency(totalFines)} all time</div>
        </div>
        <div class="stat-card amber">
          <span class="stat-card-icon">📅</span>
          <div class="stat-card-value">${todaySessions.filter(s => s.status === 'completed').length}</div>
          <div class="stat-card-label">Breaks Completed</div>
          <div class="stat-card-sub">Today so far</div>
        </div>
      </div>

      <!-- Live Feed + Recent Violations -->
      <div class="two-col">
        <!-- Live Break Feed -->
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">
              <span class="title-icon">🟢</span> Live Break Feed
              <span class="pulse-dot" style="margin-left:4px;"></span>
            </div>
            <span style="font-size:13px; color:var(--text-secondary);" id="live-feed-count">${active.length} on break</span>
          </div>
          <div class="section-body" style="max-height:340px; overflow-y:auto;">
            <div class="break-feed" id="live-break-feed">
              ${this._buildLiveFeed(active)}
            </div>
          </div>
        </div>

        <!-- Today's Violations -->
        <div class="section-card">
          <div class="section-header">
            <div class="section-title"><span class="title-icon">⚠️</span> Today's Violations</div>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('penalties')">View All</button>
          </div>
          <div class="section-body" style="max-height:340px; overflow-y:auto;">
            ${todayPen.length === 0
              ? `<div class="empty-state" style="padding:32px 16px;">
                  <div class="empty-state-icon" style="font-size:40px;">🎉</div>
                  <h3>All Clear!</h3>
                  <p>No violations today.</p>
                </div>`
              : todayPen.slice().reverse().map(p => {
                const emp = getEmployee(p.employeeId);
                return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <span style="font-size:20px;">⚠️</span>
                  <div style="flex:1;">
                    <div style="font-weight:700; font-size:14px;">${emp?.name || p.employeeId}</div>
                    <div style="font-size:12px; color:var(--text-secondary);">${p.reason}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${formatDateTime(p.date)}</div>
                  </div>
                  <div style="font-weight:800; color:var(--pink);">${formatCurrency(p.amount)}</div>
                </div>`;
              }).join('')}
          </div>
        </div>
      </div>

      <!-- Recent Break History -->
      <div class="section-card" style="margin-top:0;">
        <div class="section-header">
          <div class="section-title"><span class="title-icon">📋</span> Today's Break History</div>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('reports')">Full Report</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>Time</th><th>Employee</th><th>Break</th><th>Duration</th><th>Allowed</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${this._buildTodayHistory(todaySessions)}
            </tbody>
          </table>
        </div>
      </div>`;

    this._updateAlerts(active);
  },

  _renderEmployeeDashboard(container) {
    const empId = STATE.currentUser?.id;
    const emp = getEmployee(empId);
    if (!emp) {
      container.innerHTML = `<div class="empty-state"><h3>Employee not found</h3></div>`;
      return;
    }

    const today = new Date().toDateString();
    const todaySessions = STATE.breakSessions.filter(s =>
      s.employeeId === empId && new Date(s.startTime).toDateString() === today
    );
    const myPenalties = STATE.penalties.filter(p => p.employeeId === empId);
    const quota = getBreakQuota(emp.shiftType);
    const activeSessions = getEmployeeActiveSessions(empId);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>My Dashboard</h2>
          <p>Welcome back, ${emp.name}!</p>
        </div>
        <button class="btn btn-primary" onclick="App.navigate('breaks')">⏸️ Manage My Breaks</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card cyan">
          <span class="stat-card-icon">⏸️</span>
          <div class="stat-card-value">${todaySessions.filter(s=>s.status==='completed').length} / ${quota.length}</div>
          <div class="stat-card-label">Breaks Taken Today</div>
        </div>
        <div class="stat-card green">
          <span class="stat-card-icon">⏱️</span>
          <div class="stat-card-value">${quota.length - todaySessions.filter(s=>s.status==='completed').length}</div>
          <div class="stat-card-label">Breaks Remaining</div>
        </div>
        <div class="stat-card pink">
          <span class="stat-card-icon">⚠️</span>
          <div class="stat-card-value">${myPenalties.filter(p=>new Date(p.date).toDateString()===today).length}</div>
          <div class="stat-card-label">Violations Today</div>
        </div>
        <div class="stat-card purple">
          <span class="stat-card-icon">💰</span>
          <div class="stat-card-value">${formatCurrency(myPenalties.reduce((a,p)=>a+p.amount,0))}</div>
          <div class="stat-card-label">Total Fines</div>
        </div>
      </div>

      <!-- My Break Slots -->
      <div class="section-card">
        <div class="section-header">
          <div class="section-title"><span class="title-icon">⏸️</span> My Break Allowance Today</div>
          <span class="badge badge-cyan">${emp.shiftType}-hour shift</span>
        </div>
        <div class="section-body">
          ${quota.map((b, idx) => {
            const completed = todaySessions.find(s => s.breakIndex === idx && s.status === 'completed');
            const active = activeSessions.find(s => s.breakIndex === idx);
            const statusBadge = active
              ? '<span class="badge badge-cyan"><span class="pulse-dot" style="width:7px;height:7px;"></span> In Progress</span>'
              : completed
                ? `<span class="badge ${completed.penaltyApplied ? 'badge-red' : 'badge-green'}">${completed.penaltyApplied ? '⚠️ Penalized' : '✅ Done'} — ${formatDuration(completed.durationSeconds)}</span>`
                : '<span class="badge badge-gray">Available</span>';
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-radius:var(--radius-sm);background:rgba(0,0,0,0.2);border:1px solid var(--glass-border);margin-bottom:10px;">
              <div>
                <div style="font-weight:700;">${b.label}</div>
                <div style="font-size:13px;color:var(--text-secondary);">Allowed: ${b.allowedMinutes} minutes</div>
              </div>
              ${statusBadge}
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- My Penalty History -->
      <div class="section-card">
        <div class="section-header">
          <div class="section-title"><span class="title-icon">⚠️</span> My Penalty History</div>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Date</th><th>Break</th><th>Excess</th><th>Fine</th></tr></thead>
            <tbody>
              ${myPenalties.length === 0
                ? `<tr><td colspan="4"><div class="empty-state" style="padding:32px;"><div class="empty-state-icon" style="font-size:40px;">🎉</div><h3>No penalties!</h3><p>Keep it up!</p></div></td></tr>`
                : myPenalties.slice().reverse().map(p => `
                  <tr>
                    <td style="font-size:13px;color:var(--text-secondary);">${formatDateTime(p.date)}</td>
                    <td><span class="badge badge-amber">${p.breakLabel}</span></td>
                    <td style="color:var(--red);font-weight:700;">${formatDuration(p.excessSeconds)}</td>
                    <td style="font-weight:800;color:var(--pink);">${formatCurrency(p.amount)}</td>
                  </tr>`).join('')
              }
            </tbody>
          </table>
        </div>
      </div>`;
  },

  _buildLiveFeed(activeSessions) {
    if (activeSessions.length === 0) {
      return `<div class="empty-state" style="padding:32px 16px;">
        <div class="empty-state-icon" style="font-size:40px;">✅</div>
        <h3>All Clear</h3>
        <p>Nobody is currently on break.</p>
      </div>`;
    }

    return activeSessions.map(s => {
      const emp = getEmployee(s.employeeId);
      const elapsed = Math.floor((Date.now() - new Date(s.startTime).getTime()) / 1000);
      const remaining = s.allowedSeconds - elapsed;
      const isOvertime = remaining < 0;

      return `<div class="break-feed-item ${isOvertime ? 'overtime' : ''}" id="feed-${s.id}">
        <div class="break-feed-avatar">${emp?.name?.charAt(0) || '?'}</div>
        <div class="break-feed-info">
          <strong>${emp?.name || s.employeeId}</strong>
          <span>${s.breakLabel} · Started ${formatDateTime(s.startTime)}</span>
        </div>
        <div class="break-feed-timer ${isOvertime ? 'overtime-text' : ''}" id="feed-timer-${s.id}">
          ${isOvertime ? '⚠️ +' : ''}${formatTime(Math.abs(remaining))}
        </div>
      </div>`;
    }).join('');
  },

  _buildTodayHistory(sessions) {
    const completed = sessions.filter(s => s.status === 'completed').slice().reverse();
    const active = sessions.filter(s => s.status === 'active');
    const all = [...active, ...completed];

    if (all.length === 0) {
      return `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">No breaks recorded today.</td></tr>`;
    }

    return all.map(s => {
      const emp = getEmployee(s.employeeId);
      const isActive = s.status === 'active';
      return `<tr>
        <td style="font-size:13px;color:var(--text-secondary); white-space:nowrap;">${formatDateTime(s.startTime)}</td>
        <td style="font-weight:600;">${emp?.name || s.employeeId}</td>
        <td><span class="badge badge-purple" style="font-size:11px;">${s.breakLabel}</span></td>
        <td>${isActive ? '<span class="badge badge-cyan">In Progress</span>' : formatDuration(s.durationSeconds)}</td>
        <td style="color:var(--text-secondary);">${formatDuration(s.allowedSeconds)}</td>
        <td>${isActive
          ? '<span class="badge badge-cyan">Active</span>'
          : s.penaltyApplied
            ? '<span class="badge badge-red">⚠️ Penalized</span>'
            : '<span class="badge badge-green">✅ OK</span>'}</td>
      </tr>`;
    }).join('');
  },

  _updateAlerts(activeSessions) {
    const alertContainer = document.getElementById('dashboard-alerts');
    if (!alertContainer) return;

    const overtimeSessions = activeSessions.filter(s => {
      const elapsed = (Date.now() - new Date(s.startTime).getTime()) / 1000;
      return elapsed > s.allowedSeconds;
    });

    if (overtimeSessions.length > 0) {
      const names = overtimeSessions.map(s => getEmployee(s.employeeId)?.name || s.employeeId).join(', ');
      alertContainer.innerHTML = `<div class="alert-banner danger">🚨 ${overtimeSessions.length} employee${overtimeSessions.length > 1 ? 's are' : ' is'} over break time: ${names}</div>`;
    } else {
      alertContainer.innerHTML = '';
    }
  },

  refresh() {
    // Update live stats without full re-render
    const active = getActiveSessions();
    const todayPen = getTodayPenalties();
    const todayFines = todayPen.reduce((a, p) => a + p.amount, 0);
    const today = new Date().toDateString();
    const todaySessions = STATE.breakSessions.filter(s => new Date(s.startTime).toDateString() === today);

    const statActive = document.getElementById('stat-active');
    const statViolations = document.getElementById('stat-violations');
    const statFines = document.getElementById('stat-fines');
    const feedCount = document.getElementById('live-feed-count');

    if (statActive) statActive.textContent = active.length;
    if (statViolations) statViolations.textContent = todayPen.length;
    if (statFines) statFines.textContent = formatCurrency(todayFines);
    if (feedCount) feedCount.textContent = `${active.length} on break`;

    // Update live feed timers
    active.forEach(s => {
      const elapsed = Math.floor((Date.now() - new Date(s.startTime).getTime()) / 1000);
      const remaining = s.allowedSeconds - elapsed;
      const isOvertime = remaining < 0;

      const timerEl = document.getElementById(`feed-timer-${s.id}`);
      const feedItem = document.getElementById(`feed-${s.id}`);
      if (timerEl) {
        timerEl.textContent = (isOvertime ? '⚠️ +' : '') + formatTime(Math.abs(remaining));
        timerEl.classList.toggle('overtime-text', isOvertime);
      }
      if (feedItem) feedItem.classList.toggle('overtime', isOvertime);
    });

    // Rebuild feed if count changed (someone started/ended break)
    const feedEl = document.getElementById('live-break-feed');
    if (feedEl) {
      const renderedCount = feedEl.querySelectorAll('.break-feed-item').length;
      if (renderedCount !== active.length) {
        feedEl.innerHTML = this._buildLiveFeed(active);
      }
    }

    this._updateAlerts(active);
  }
};
