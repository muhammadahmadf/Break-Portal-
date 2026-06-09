/* ============================================================
   reports.js — Monthly Excel Report Generation
   ============================================================ */

'use strict';

window.Reports = {
  _selectedMonth: null,
  _selectedYear: null,

  render() {
    const now = new Date();
    this._selectedMonth = this._selectedMonth ?? now.getMonth();
    this._selectedYear = this._selectedYear ?? now.getFullYear();

    const container = document.getElementById('view-container');
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Reports</h2>
          <p>Generate and download monthly break reports in Excel format</p>
        </div>
      </div>

      <!-- Report Config -->
      <div class="section-card mb-16">
        <div class="section-header">
          <div class="section-title"><span class="title-icon">⚙️</span> Report Configuration</div>
        </div>
        <div class="section-body">
          <div class="month-picker">
            <div class="form-group" style="margin:0; min-width:180px;">
              <label class="form-label">Month</label>
              <select class="form-input" id="report-month" onchange="Reports.updatePreview()">
                ${['January','February','March','April','May','June','July','August','September','October','November','December']
                  .map((m, i) => `<option value="${i}" ${i === this._selectedMonth ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin:0; min-width:120px;">
              <label class="form-label">Year</label>
              <select class="form-input" id="report-year" onchange="Reports.updatePreview()">
                ${[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1]
                  .map(y => `<option value="${y}" ${y === this._selectedYear ? 'selected' : ''}>${y}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">&nbsp;</label>
              <button class="btn btn-primary" onclick="Reports.generateAndDownload()">⬇️ Download Excel Report</button>
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">&nbsp;</label>
              <button class="btn btn-ghost" onclick="Reports.generateAndDownload('detailed')">📋 Detailed Report</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview -->
      <div class="section-card">
        <div class="section-header">
          <div class="section-title"><span class="title-icon">👁️</span> Report Preview</div>
          <span id="report-period-label" style="font-size:13px; color:var(--cyan);">
            ${this._getMonthLabel(this._selectedMonth, this._selectedYear)}
          </span>
        </div>
        <div class="section-body">
          <div id="report-summary-cards" class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); margin-bottom:20px;">
            ${this._buildSummaryCards(this._selectedMonth, this._selectedYear)}
          </div>
          <div class="table-wrapper report-preview">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>ID</th>
                  <th>Department</th>
                  <th>Shift</th>
                  <th>Total Breaks</th>
                  <th>Total Break Time</th>
                  <th>Allowed Time</th>
                  <th>Excess Time</th>
                  <th>Violations</th>
                  <th>Total Fines</th>
                </tr>
              </thead>
              <tbody id="report-table-body">
                ${this._buildReportRows(this._selectedMonth, this._selectedYear)}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  },

  _getMonthLabel(month, year) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[month]} ${year}`;
  },

  _getMonthData(month, year) {
    const sessions = STATE.breakSessions.filter(s => {
      const d = new Date(s.startTime);
      return d.getMonth() === month && d.getFullYear() === year && s.status === 'completed';
    });

    const penalties = STATE.penalties.filter(p => {
      const d = new Date(p.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    return { sessions, penalties };
  },

  _buildSummaryCards(month, year) {
    const { sessions, penalties } = this._getMonthData(month, year);
    const totalTime = sessions.reduce((a, s) => a + s.durationSeconds, 0);
    const totalFines = penalties.reduce((a, p) => a + p.amount, 0);

    return `
      <div class="stat-card cyan">
        <span class="stat-card-icon">⏸️</span>
        <div class="stat-card-value">${sessions.length}</div>
        <div class="stat-card-label">Total Breaks</div>
      </div>
      <div class="stat-card green">
        <span class="stat-card-icon">⏱️</span>
        <div class="stat-card-value">${Math.floor(totalTime/60)}m</div>
        <div class="stat-card-label">Total Break Time</div>
      </div>
      <div class="stat-card pink">
        <span class="stat-card-icon">⚠️</span>
        <div class="stat-card-value">${penalties.length}</div>
        <div class="stat-card-label">Violations</div>
      </div>
      <div class="stat-card purple">
        <span class="stat-card-icon">💰</span>
        <div class="stat-card-value">${formatCurrency(totalFines)}</div>
        <div class="stat-card-label">Total Fines</div>
      </div>`;
  },

  _buildReportRows(month, year) {
    const { sessions, penalties } = this._getMonthData(month, year);

    if (STATE.employees.length === 0) {
      return `<tr><td colspan="10"><div class="empty-state"><h3>No data</h3></div></td></tr>`;
    }

    const rows = STATE.employees.map(emp => {
      const empSessions = sessions.filter(s => s.employeeId === emp.employeeId);
      const empPenalties = penalties.filter(p => p.employeeId === emp.employeeId);
      const quota = getBreakQuota(emp.shiftType);

      // Working days in month (estimate ~22)
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const workdays = Math.round(daysInMonth * 5 / 7);
      const allowedTotalSeconds = quota.reduce((a, b) => a + b.allowedMinutes * 60, 0) * workdays;

      const totalBreakSec = empSessions.reduce((a, s) => a + s.durationSeconds, 0);
      const totalFines = empPenalties.reduce((a, p) => a + p.amount, 0);
      const excessSec = Math.max(0, totalBreakSec - allowedTotalSeconds);

      return `<tr>
        <td style="font-weight:700;">${emp.name}</td>
        <td><span class="badge badge-purple">${emp.employeeId}</span></td>
        <td class="td-muted">${emp.department || '—'}</td>
        <td><span class="badge ${emp.shiftType==='12'?'badge-amber':'badge-cyan'}">${emp.shiftType}h</span></td>
        <td style="text-align:center; font-weight:700;">${empSessions.length}</td>
        <td>${formatDuration(totalBreakSec)}</td>
        <td style="color:var(--text-secondary);">${formatDuration(allowedTotalSeconds)}</td>
        <td style="color:${excessSec > 0 ? 'var(--red)' : 'var(--green)'}; font-weight:700;">${excessSec > 0 ? '+' + formatDuration(excessSec) : '✔ Within Limit'}</td>
        <td>${empPenalties.length > 0
          ? `<span class="badge badge-red">${empPenalties.length}</span>`
          : `<span class="badge badge-green">0</span>`}</td>
        <td style="font-weight:800; color:${totalFines > 0 ? 'var(--pink)' : 'var(--green)'};">${formatCurrency(totalFines)}</td>
      </tr>`;
    }).join('');

    return rows;
  },

  updatePreview() {
    this._selectedMonth = parseInt(document.getElementById('report-month').value);
    this._selectedYear = parseInt(document.getElementById('report-year').value);

    const label = document.getElementById('report-period-label');
    const summary = document.getElementById('report-summary-cards');
    const tbody = document.getElementById('report-table-body');

    if (label) label.textContent = this._getMonthLabel(this._selectedMonth, this._selectedYear);
    if (summary) summary.innerHTML = this._buildSummaryCards(this._selectedMonth, this._selectedYear);
    if (tbody) tbody.innerHTML = this._buildReportRows(this._selectedMonth, this._selectedYear);
  },

  generateAndDownload(type = 'summary') {
    const month = this._selectedMonth ?? new Date().getMonth();
    const year = this._selectedYear ?? new Date().getFullYear();
    const { sessions, penalties } = this._getMonthData(month, year);
    const monthLabel = this._getMonthLabel(month, year);
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Summary ─────────────────────────────────────
    const summaryData = STATE.employees.map(emp => {
      const empSessions = sessions.filter(s => s.employeeId === emp.employeeId);
      const empPenalties = penalties.filter(p => p.employeeId === emp.employeeId);
      const quota = getBreakQuota(emp.shiftType);
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const workdays = Math.round(daysInMonth * 5 / 7);
      const allowedSec = quota.reduce((a, b) => a + b.allowedMinutes * 60, 0) * workdays;
      const totalSec = empSessions.reduce((a, s) => a + s.durationSeconds, 0);
      const totalFines = empPenalties.reduce((a, p) => a + p.amount, 0);

      return {
        'Employee Name': emp.name,
        'Employee ID': emp.employeeId,
        'Department': emp.department || '',
        'Shift Type': `${emp.shiftType}-Hour`,
        'Shift Hours': `${emp.shiftStart} - ${emp.shiftEnd}`,
        'Total Breaks Taken': empSessions.length,
        'Total Break Time (min)': Math.round(totalSec / 60),
        'Allowed Break Time (min)': Math.round(allowedSec / 60),
        'Excess Time (min)': Math.max(0, Math.round((totalSec - allowedSec) / 60)),
        'Violations': empPenalties.length,
        [`Total Fines (${STATE.settings.currency})`]: totalFines,
        'Status': emp.status
      };
    });

    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    // Style header row
    ws1['!cols'] = [
      {wch:25},{wch:12},{wch:15},{wch:12},{wch:14},
      {wch:18},{wch:22},{wch:22},{wch:18},{wch:12},{wch:16},{wch:10}
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Monthly Summary');

    if (type === 'detailed') {
      // ── Sheet 2: Break Sessions ─────────────────────────────
      const sessionData = sessions.map(s => {
        const emp = getEmployee(s.employeeId);
        return {
          'Date': formatDate(s.startTime),
          'Start Time': new Date(s.startTime).toLocaleTimeString('en-IN'),
          'End Time': s.endTime ? new Date(s.endTime).toLocaleTimeString('en-IN') : '',
          'Employee Name': emp?.name || s.employeeId,
          'Employee ID': s.employeeId,
          'Break': s.breakLabel,
          'Duration (min)': Math.round(s.durationSeconds / 60),
          'Allowed (min)': Math.round(s.allowedSeconds / 60),
          'Excess (min)': Math.max(0, Math.round((s.durationSeconds - s.allowedSeconds) / 60)),
          'Penalized': s.penaltyApplied ? 'Yes' : 'No'
        };
      });

      const ws2 = XLSX.utils.json_to_sheet(sessionData);
      ws2['!cols'] = [{wch:12},{wch:12},{wch:12},{wch:22},{wch:12},{wch:20},{wch:14},{wch:14},{wch:12},{wch:10}];
      XLSX.utils.book_append_sheet(wb, ws2, 'Break Sessions');

      // ── Sheet 3: Penalties ──────────────────────────────────
      const penData = penalties.map(p => {
        const emp = getEmployee(p.employeeId);
        return {
          'Date': formatDateTime(p.date),
          'Employee Name': emp?.name || p.employeeId,
          'Employee ID': p.employeeId,
          'Break': p.breakLabel,
          'Excess Time (min)': Math.round(p.excessSeconds / 60),
          'Reason': p.reason,
          [`Fine (${STATE.settings.currency})`]: p.amount
        };
      });

      const ws3 = XLSX.utils.json_to_sheet(penData);
      ws3['!cols'] = [{wch:20},{wch:22},{wch:12},{wch:20},{wch:16},{wch:40},{wch:14}];
      XLSX.utils.book_append_sheet(wb, ws3, 'Penalties');
    }

    // ── Metadata Sheet ──────────────────────────────────────
    const meta = [
      ['BreakDesk — Employee Break Management Portal'],
      ['Report Period', monthLabel],
      ['Generated At', formatDateTime(new Date().toISOString())],
      ['Total Employees', STATE.employees.length],
      ['Active Employees', STATE.employees.filter(e=>e.status==='active').length],
      ['Total Breaks This Month', sessions.length],
      ['Total Violations', penalties.length],
      [`Total Fines (${STATE.settings.currency})`, penalties.reduce((a,p)=>a+p.amount,0)]
    ];
    const wsMeta = XLSX.utils.aoa_to_sheet(meta);
    wsMeta['!cols'] = [{wch:30},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Report Info');

    const filename = `BreakDesk_Report_${monthLabel.replace(' ', '_')}_${type === 'detailed' ? 'Detailed' : 'Summary'}.xlsx`;
    XLSX.writeFile(wb, filename);
    addAuditLog('report', 'Report Generated', `${type} report for ${monthLabel} downloaded`);
    Toast.show('success', 'Report Downloaded!', `${filename} has been saved.`);
  },

  quickExport() {
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    this._selectedMonth = month;
    this._selectedYear = year;
    this.generateAndDownload();
  }
};
