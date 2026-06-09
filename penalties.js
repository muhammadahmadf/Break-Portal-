/* ============================================================
   penalties.js — Penalty Tracking & Violation Log
   ============================================================ */

'use strict';

window.Penalties = {
  _filterEmployee: '',
  _filterDateFrom: '',
  _filterDateTo: '',

  render() {
    const container = document.getElementById('view-container');
    const today = new Date();
    const todayPen = getTodayPenalties();
    const totalFines = STATE.penalties.reduce((a, p) => a + p.amount, 0);
    const thisMonthPen = STATE.penalties.filter(p => {
      const d = new Date(p.date);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });

    // Per-employee summary
    const empMap = {};
    STATE.penalties.forEach(p => {
      if (!empMap[p.employeeId]) empMap[p.employeeId] = { count: 0, total: 0 };
      empMap[p.employeeId].count++;
      empMap[p.employeeId].total += p.amount;
    });
    const topOffenders = Object.entries(empMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Penalties</h2>
          <p>Violation tracking and fine management</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-ghost btn-sm" onclick="Penalties.exportPenalties()">📊 Export to Excel</button>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="stats-grid" style="margin-bottom:24px;">
        <div class="stat-card red">
          <span class="stat-card-icon">🚨</span>
          <div class="stat-card-value">${todayPen.length}</div>
          <div class="stat-card-label">Violations Today</div>
          <div class="stat-card-sub">${formatCurrency(todayPen.reduce((a,p)=>a+p.amount,0))} in fines</div>
        </div>
        <div class="stat-card amber">
          <span class="stat-card-icon">📅</span>
          <div class="stat-card-value">${thisMonthPen.length}</div>
          <div class="stat-card-label">This Month</div>
          <div class="stat-card-sub">${formatCurrency(thisMonthPen.reduce((a,p)=>a+p.amount,0))}</div>
        </div>
        <div class="stat-card pink">
          <span class="stat-card-icon">⚠️</span>
          <div class="stat-card-value">${STATE.penalties.length}</div>
          <div class="stat-card-label">Total Violations</div>
          <div class="stat-card-sub">All time</div>
        </div>
        <div class="stat-card purple">
          <span class="stat-card-icon">💰</span>
          <div class="stat-card-value">${formatCurrency(totalFines)}</div>
          <div class="stat-card-label">Total Fines</div>
          <div class="stat-card-sub">All time</div>
        </div>
      </div>

      <div class="two-col" style="margin-bottom:20px;">
        <!-- Top Offenders -->
        <div class="section-card">
          <div class="section-header">
            <div class="section-title"><span class="title-icon">🏆</span> Top Violators</div>
          </div>
          <div class="section-body">
            ${topOffenders.length === 0
              ? '<div class="empty-state" style="padding:24px;"><div class="empty-state-icon" style="font-size:32px;">🎉</div><p>No violations recorded.</p></div>'
              : topOffenders.map(([empId, data], i) => {
                const emp = getEmployee(empId);
                const medals = ['🥇', '🥈', '🥉'];
                return `<div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                  <span style="font-size:24px;">${medals[i]}</span>
                  <div style="flex:1;">
                    <div style="font-weight:700;">${emp?.name || empId}</div>
                    <div style="font-size:12px; color:var(--text-secondary);">${emp?.employeeId || empId}</div>
                  </div>
                  <div style="text-align:right;">
                    <div class="badge badge-red">${data.count} violation${data.count>1?'s':''}</div>
                    <div style="font-size:12px; color:var(--pink); font-weight:700; margin-top:4px;">${formatCurrency(data.total)}</div>
                  </div>
                </div>`;
              }).join('')
            }
          </div>
        </div>

        <!-- Employee Summary Table -->
        <div class="section-card">
          <div class="section-header">
            <div class="section-title"><span class="title-icon">👥</span> Employee Fine Summary</div>
          </div>
          <div style="max-height:280px; overflow-y:auto;">
            <table>
              <thead>
                <tr><th>Employee</th><th>Violations</th><th>Total Fines</th></tr>
              </thead>
              <tbody>
                ${STATE.employees.filter(e => empMap[e.employeeId]).map(emp => `
                  <tr>
                    <td><div style="font-weight:600;">${emp.name}</div><div style="font-size:11px;color:var(--text-muted);">${emp.employeeId}</div></td>
                    <td><span class="badge badge-red">${empMap[emp.employeeId].count}</span></td>
                    <td style="font-weight:700; color:var(--pink);">${formatCurrency(empMap[emp.employeeId].total)}</td>
                  </tr>`).join('')}
                ${STATE.employees.filter(e => !empMap[e.employeeId] && e.status === 'active').map(emp => `
                  <tr>
                    <td><div style="font-weight:600;">${emp.name}</div><div style="font-size:11px;color:var(--text-muted);">${emp.employeeId}</div></td>
                    <td><span class="badge badge-green">0</span></td>
                    <td style="font-weight:700; color:var(--green);">${formatCurrency(0)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Violation Log -->
      <div class="section-card">
        <div class="section-header">
          <div class="section-title"><span class="title-icon">📋</span> Violation Log</div>
          <div class="search-bar">
            <select class="form-input" id="pen-filter-emp" onchange="Penalties.onFilterEmployee(this.value)" style="width:200px; padding:10px 14px;">
              <option value="">All Employees</option>
              ${STATE.employees.map(e => `<option value="${e.employeeId}">${e.name} (${e.employeeId})</option>`).join('')}
            </select>
            <input class="form-input" type="date" id="pen-filter-from" onchange="Penalties.onFilterDate()" style="padding:10px 14px;" title="From date">
            <input class="form-input" type="date" id="pen-filter-to" onchange="Penalties.onFilterDate()" style="padding:10px 14px;" title="To date">
          </div>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Employee</th>
                <th>Break</th>
                <th>Excess Time</th>
                <th>Reason</th>
                <th>Fine</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="penalties-table-body">
              ${this._renderRows()}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  _getFiltered() {
    return STATE.penalties.filter(p => {
      const matchEmp = !this._filterEmployee || p.employeeId === this._filterEmployee;
      const penDate = new Date(p.date);
      const matchFrom = !this._filterDateFrom || penDate >= new Date(this._filterDateFrom);
      const matchTo = !this._filterDateTo || penDate <= new Date(this._filterDateTo + 'T23:59:59');
      return matchEmp && matchFrom && matchTo;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  _renderRows() {
    const penalties = this._getFiltered();

    if (penalties.length === 0) {
      return `<tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-state-icon">🎉</div>
          <h3>No Violations Found</h3>
          <p>No penalty records match your filter.</p>
        </div>
      </td></tr>`;
    }

    return penalties.map(p => {
      const emp = getEmployee(p.employeeId);
      return `<tr class="penalty-row">
        <td style="white-space:nowrap; color:var(--text-secondary); font-size:13px;">${formatDateTime(p.date)}</td>
        <td>
          <div style="font-weight:700;">${emp?.name || p.employeeId}</div>
          <div style="font-size:11px; color:var(--text-muted);">${p.employeeId}</div>
        </td>
        <td><span class="badge badge-amber">${p.breakLabel}</span></td>
        <td style="color:var(--red); font-weight:700;">${formatDuration(p.excessSeconds)}</td>
        <td style="font-size:13px; color:var(--text-secondary); max-width:200px;">${p.reason}</td>
        <td style="font-weight:800; color:var(--pink);">${formatCurrency(p.amount)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="Penalties.waivePenalty('${p.id}')" title="Waive this penalty">🙏 Waive</button>
        </td>
      </tr>`;
    }).join('');
  },

  onFilterEmployee(val) {
    this._filterEmployee = val;
    document.getElementById('penalties-table-body').innerHTML = this._renderRows();
  },

  onFilterDate() {
    this._filterDateFrom = document.getElementById('pen-filter-from').value;
    this._filterDateTo = document.getElementById('pen-filter-to').value;
    document.getElementById('penalties-table-body').innerHTML = this._renderRows();
  },

  waivePenalty(penaltyId) {
    const pen = STATE.penalties.find(p => p.id === penaltyId);
    if (!pen) return;
    const emp = getEmployee(pen.employeeId);

    App.confirm(
      'Waive Penalty',
      `Waive the ${formatCurrency(pen.amount)} fine for ${emp?.name || pen.employeeId} (${pen.breakLabel})? This cannot be undone.`,
      'Waive Fine',
      () => {
        STATE.penalties = STATE.penalties.filter(p => p.id !== penaltyId);
        // Also unmark the session
        const session = STATE.breakSessions.find(s => s.id === pen.sessionId);
        if (session) session.penaltyApplied = false;
        addAuditLog('penalty_applied', 'Penalty Waived', `Fine waived for ${emp?.name || pen.employeeId}: ${pen.reason}`);
        saveState();
        Toast.show('success', 'Penalty Waived', `The fine has been removed for ${emp?.name || pen.employeeId}.`);
        this.render();
      },
      'btn-warning'
    );
  },

  exportPenalties() {
    const data = STATE.penalties.map(p => {
      const emp = getEmployee(p.employeeId);
      return {
        'Date': formatDateTime(p.date),
        'Employee Name': emp?.name || p.employeeId,
        'Employee ID': p.employeeId,
        'Break': p.breakLabel,
        'Excess Time': formatDuration(p.excessSeconds),
        'Reason': p.reason,
        [`Fine (${STATE.settings.currency})`]: p.amount
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Penalties');
    XLSX.writeFile(wb, `breakdesk-penalties-${new Date().toISOString().split('T')[0]}.xlsx`);
    addAuditLog('report', 'Penalties Exported', 'Penalty data exported to Excel');
    Toast.show('success', 'Exported', 'Penalty report downloaded.');
  }
};
