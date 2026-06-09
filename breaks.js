/* ============================================================
   breaks.js — Break Tracking System with Real-time Timers
   ============================================================ */

'use strict';

window.Breaks = {
  _searchTerm: '',
  _filterShift: '',

  render() {
    const isEmployee = STATE.currentUser?.role === 'employee';
    let employees = STATE.employees.filter(e => e.status === 'active');

    if (isEmployee) {
      employees = employees.filter(e => e.employeeId === STATE.currentUser.id);
    }

    const container = document.getElementById('view-container');
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Break Tracker</h2>
          <p>Real-time break monitoring — <span class="pulse-dot"></span> ${getActiveSessions().length} employees currently on break</p>
        </div>
        ${!isEmployee ? `
        <div class="page-header-actions">
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input class="form-input" type="text" id="breaks-search" placeholder="Search employee…" oninput="Breaks.onSearch(this.value)" style="width:200px;">
          </div>
          <select class="form-input" onchange="Breaks.onFilterShift(this.value)" style="width:140px; padding:10px 14px;">
            <option value="">All Shifts</option>
            <option value="8">8-Hour</option>
            <option value="12">12-Hour</option>
          </select>
        </div>` : ''}
      </div>

      <div class="breaks-grid" id="breaks-grid">
        ${this._buildCards(employees)}
      </div>`;
  },

  _buildCards(employees) {
    if (!employees || employees.length === 0) {
      return `<div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">⏸️</div>
        <h3>No Employees Found</h3>
        <p>Add employees to begin tracking breaks.</p>
      </div>`;
    }

    const filtered = employees.filter(emp => {
      const matchSearch = !this._searchTerm ||
        emp.name.toLowerCase().includes(this._searchTerm.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(this._searchTerm.toLowerCase());
      const matchShift = !this._filterShift || emp.shiftType === this._filterShift;
      return matchSearch && matchShift;
    });

    if (filtered.length === 0) {
      return `<div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">🔍</div>
        <h3>No Matches</h3>
        <p>Try a different search term.</p>
      </div>`;
    }

    return filtered.map(emp => this._buildCard(emp)).join('');
  },

  _buildCard(emp) {
    const quota = getBreakQuota(emp.shiftType);
    const today = new Date().toDateString();
    const todaySessions = STATE.breakSessions.filter(s =>
      s.employeeId === emp.employeeId &&
      new Date(s.startTime).toDateString() === today
    );
    const activeSessions = getEmployeeActiveSessions(emp.employeeId);
    const isOnBreak = activeSessions.length > 0;

    const breaksHTML = quota.map((b, idx) => {
      const completedSession = todaySessions.find(s => s.breakIndex === idx && s.status === 'completed');
      const activeSession = activeSessions.find(s => s.breakIndex === idx);
      const isUsed = !!completedSession;
      const isActive = !!activeSession;

      let slotClass = '';
      let timerHTML = '';
      let actionBtn = '';

      if (isActive) {
        slotClass = 'active-break';
        const elapsed = Math.floor((Date.now() - new Date(activeSession.startTime).getTime()) / 1000);
        const remaining = b.allowedMinutes * 60 - elapsed;
        const isOvertime = remaining < 0;
        timerHTML = `<span class="break-slot-timer${isOvertime ? ' overtime' : ''}" id="timer-${activeSession.id}">
          ${isOvertime ? '⚠️ +' : ''}${formatTime(Math.abs(remaining))}
        </span>`;
        actionBtn = `<button class="btn btn-danger btn-sm" onclick="Breaks.endBreak('${activeSession.id}', '${emp.id}')">⏹ End Break</button>`;
      } else if (isUsed) {
        slotClass = 'used';
        const dur = completedSession.durationSeconds;
        const penalized = completedSession.penaltyApplied;
        timerHTML = `<span style="font-size:12px; color:${penalized ? 'var(--red)' : 'var(--green)'};">
          ${penalized ? '⚠️' : '✅'} ${formatDuration(dur)}
        </span>`;
        actionBtn = `<span class="badge ${penalized ? 'badge-red' : 'badge-green'}">${penalized ? 'Fine Applied' : 'Completed'}</span>`;
      } else if (!isOnBreak) {
        // Available to start
        actionBtn = `<button class="btn btn-success btn-sm" onclick="Breaks.startBreak('${emp.employeeId}', ${idx}, '${emp.id}')">▶ Start</button>`;
      } else {
        // Another break is active
        actionBtn = `<span class="td-muted" style="font-size:12px;">Wait…</span>`;
      }

      // Progress bar
      let progressHTML = '';
      if (isActive) {
        const activeSession2 = activeSessions.find(s => s.breakIndex === idx);
        if (activeSession2) {
          const elapsed2 = Math.floor((Date.now() - new Date(activeSession2.startTime).getTime()) / 1000);
          const pct = Math.min((elapsed2 / (b.allowedMinutes * 60)) * 100, 100);
          const isDanger = pct >= 80;
          progressHTML = `<div class="progress-bar" style="margin-top:8px;">
            <div class="progress-fill${isDanger ? ' danger' : ''}" id="prog-${activeSession2.id}" style="width:${pct}%"></div>
          </div>`;
        }
      }

      return `
        <div class="break-slot ${slotClass}" id="slot-${emp.employeeId}-${idx}">
          <div style="flex:1;">
            <div class="break-slot-label">${b.label}</div>
            <div class="break-slot-duration">Allowed: ${b.allowedMinutes} min</div>
            ${progressHTML}
          </div>
          ${timerHTML}
          ${actionBtn}
        </div>`;
    }).join('');

    const todayPenalties = STATE.penalties.filter(p =>
      p.employeeId === emp.employeeId &&
      new Date(p.date).toDateString() === today
    );

    return `
      <div class="employee-break-card ${isOnBreak ? 'on-break' : ''}" id="ebc-${emp.employeeId}">
        <div class="ebc-header">
          <div class="ebc-avatar">${emp.name.charAt(0)}</div>
          <div style="flex:1; min-width:0;">
            <div class="ebc-name">${emp.name}</div>
            <div class="ebc-id">${emp.employeeId} · ${emp.department || 'No Dept'}</div>
            <div class="ebc-shift">${emp.shiftType}h shift · ${emp.shiftStart}–${emp.shiftEnd}</div>
          </div>
          <div style="text-align:right;">
            ${isOnBreak ? '<span class="badge badge-cyan" style="animation:none;"><span class="pulse-dot" style="width:7px;height:7px;"></span> On Break</span>' : '<span class="badge badge-gray">Available</span>'}
            ${todayPenalties.length > 0 ? `<div style="margin-top:6px;"><span class="badge badge-red">⚠️ ${todayPenalties.length} fine${todayPenalties.length>1?'s':''}</span></div>` : ''}
          </div>
        </div>
        <div class="ebc-breaks">
          ${breaksHTML}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:12px; color:var(--text-muted);">
          <span>Breaks used today: ${todaySessions.filter(s=>s.status==='completed').length} / ${quota.length}</span>
          <span>Fines today: ${formatCurrency(todayPenalties.reduce((a,p)=>a+p.amount,0))}</span>
        </div>
      </div>`;
  },

  startBreak(employeeId, breakIdx, internalId) {
    const emp = getEmployee(employeeId);
    if (!emp) return;

    const quota = getBreakQuota(emp.shiftType);
    if (breakIdx >= quota.length) {
      Toast.show('error', 'Invalid Break', 'This break slot does not exist for this shift type.');
      return;
    }

    // Check if this break already used today
    const today = new Date().toDateString();
    const alreadyUsed = STATE.breakSessions.find(s =>
      s.employeeId === employeeId &&
      s.breakIndex === breakIdx &&
      new Date(s.startTime).toDateString() === today &&
      s.status === 'completed'
    );
    if (alreadyUsed) {
      Toast.show('warning', 'Break Already Used', `${emp.name} has already taken Break ${breakIdx+1} today.`);
      return;
    }

    // Check no active break already
    const active = getEmployeeActiveSessions(employeeId);
    if (active.length > 0) {
      Toast.show('warning', 'Already on Break', `${emp.name} is already on a break. Please end it first.`);
      return;
    }

    const breakInfo = quota[breakIdx];
    const session = {
      id: genId(),
      employeeId,
      breakIndex: breakIdx,
      breakLabel: `${breakInfo.label} (${breakInfo.allowedMinutes} min)`,
      allowedSeconds: breakInfo.allowedMinutes * 60,
      startTime: new Date().toISOString(),
      endTime: null,
      durationSeconds: 0,
      status: 'active',
      penaltyApplied: false
    };

    STATE.breakSessions.push(session);
    saveState();
    addAuditLog('break_started', 'Break Started', `${emp.name} started ${breakInfo.label} (${breakInfo.allowedMinutes}min)`);
    Toast.show('info', 'Break Started', `${emp.name}'s ${breakInfo.label} has started.`);

    // Re-render
    this.render();
  },

  endBreak(sessionId, internalId) {
    const session = STATE.breakSessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'active') {
      Toast.show('error', 'Error', 'Session not found or already ended.');
      return;
    }

    const emp = getEmployee(session.employeeId);
    if (!emp) return;

    const endTime = new Date();
    const startTime = new Date(session.startTime);
    const durationSeconds = Math.floor((endTime - startTime) / 1000);
    const excess = durationSeconds - session.allowedSeconds;

    session.endTime = endTime.toISOString();
    session.durationSeconds = durationSeconds;
    session.status = 'completed';

    let penaltyApplied = false;

    if (excess > 0) {
      // Apply penalty
      const penalty = {
        id: genId(),
        employeeId: session.employeeId,
        sessionId: session.id,
        date: endTime.toISOString(),
        excessSeconds: excess,
        amount: STATE.settings.penaltyAmount,
        breakLabel: session.breakLabel,
        reason: `Exceeded ${session.breakLabel} by ${formatDuration(excess)}`
      };
      STATE.penalties.push(penalty);
      session.penaltyApplied = true;
      penaltyApplied = true;

      addAuditLog('penalty_applied', 'Penalty Applied',
        `${emp.name} exceeded ${session.breakLabel} by ${formatDuration(excess)} — Fine: ${formatCurrency(STATE.settings.penaltyAmount)}`);
      Toast.show('error', `Penalty Applied — ${formatCurrency(STATE.settings.penaltyAmount)}`,
        `${emp.name} exceeded ${session.breakLabel} by ${formatDuration(excess)}.`);
    } else {
      Toast.show('success', 'Break Ended', `${emp.name} returned from ${session.breakLabel} with ${formatDuration(-excess)} to spare.`);
    }

    addAuditLog('break_ended', 'Break Ended',
      `${emp.name} ended ${session.breakLabel} — Duration: ${formatDuration(durationSeconds)}${penaltyApplied ? ' (PENALTY)' : ''}`);

    saveState();
    this.render();
  },

  refreshTimers() {
    const activeSessions = getActiveSessions();

    activeSessions.forEach(session => {
      const elapsed = Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000);
      const remaining = session.allowedSeconds - elapsed;
      const isOvertime = remaining < 0;

      const timerEl = document.getElementById(`timer-${session.id}`);
      if (timerEl) {
        timerEl.textContent = (isOvertime ? '⚠️ +' : '') + formatTime(Math.abs(remaining));
        timerEl.classList.toggle('overtime', isOvertime);
      }

      // Update progress bar
      const progEl = document.getElementById(`prog-${session.id}`);
      if (progEl) {
        const pct = Math.min((elapsed / session.allowedSeconds) * 100, 100);
        progEl.style.width = `${pct}%`;
        progEl.classList.toggle('danger', pct >= 80);
      }
    });

    // Update live break count in header
    const liveEl = document.querySelector('#view-container .page-header-left p');
    if (liveEl && App.currentView === 'breaks') {
      const count = activeSessions.length;
      liveEl.innerHTML = `Real-time break monitoring — <span class="pulse-dot"></span> ${count} employee${count !== 1 ? 's' : ''} currently on break`;
    }
  },

  onSearch(val) {
    this._searchTerm = val;
    const isEmployee = STATE.currentUser?.role === 'employee';
    let employees = STATE.employees.filter(e => e.status === 'active');
    if (isEmployee) employees = employees.filter(e => e.employeeId === STATE.currentUser.id);
    document.getElementById('breaks-grid').innerHTML = this._buildCards(employees);
  },

  onFilterShift(val) {
    this._filterShift = val;
    const isEmployee = STATE.currentUser?.role === 'employee';
    let employees = STATE.employees.filter(e => e.status === 'active');
    if (isEmployee) employees = employees.filter(e => e.employeeId === STATE.currentUser.id);
    document.getElementById('breaks-grid').innerHTML = this._buildCards(employees);
  }
};
