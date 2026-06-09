/* ============================================================
   employees.js — Employee CRUD + Bulk Import
   ============================================================ */

'use strict';

window.Employees = {
  _searchTerm: '',
  _filterShift: '',
  _filterStatus: 'active',
  _importData: [],

  render() {
    const container = document.getElementById('view-container');
    container.innerHTML = this._buildHTML();
    this._bindSearch();
    this._renderTable();
  },

  _buildHTML() {
    return `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Employees</h2>
          <p>Manage your workforce — ${STATE.employees.filter(e => e.status === 'active').length} active of ${STATE.employees.length} total</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-ghost" onclick="Employees.openImportModal()">📤 Bulk Import</button>
          <button class="btn btn-primary" onclick="Employees.openModal()">➕ Add Employee</button>
        </div>
      </div>

      <!-- Stats row -->
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); margin-bottom:20px;">
        <div class="stat-card cyan">
          <span class="stat-card-icon">👥</span>
          <div class="stat-card-value" id="emp-stat-total">${STATE.employees.length}</div>
          <div class="stat-card-label">Total</div>
        </div>
        <div class="stat-card green">
          <span class="stat-card-icon">✅</span>
          <div class="stat-card-value" id="emp-stat-active">${STATE.employees.filter(e=>e.status==='active').length}</div>
          <div class="stat-card-label">Active</div>
        </div>
        <div class="stat-card amber">
          <span class="stat-card-icon">⏱️</span>
          <div class="stat-card-value" id="emp-stat-8h">${STATE.employees.filter(e=>e.shiftType==='8').length}</div>
          <div class="stat-card-label">8-Hour Shifts</div>
        </div>
        <div class="stat-card purple">
          <span class="stat-card-icon">🌙</span>
          <div class="stat-card-value" id="emp-stat-12h">${STATE.employees.filter(e=>e.shiftType==='12').length}</div>
          <div class="stat-card-label">12-Hour Shifts</div>
        </div>
      </div>

      <!-- Search & Filter -->
      <div class="section-card">
        <div class="section-header">
          <div class="section-title"><span class="title-icon">👥</span> Employee Directory</div>
          <div class="search-bar">
            <div class="search-input-wrapper">
              <span class="search-icon">🔍</span>
              <input class="form-input" type="text" id="emp-search" placeholder="Search by name or ID…" oninput="Employees.onSearch(this.value)" style="width:220px;">
            </div>
            <select class="form-input" id="emp-filter-shift" onchange="Employees.onFilterShift(this.value)" style="width:150px; padding:10px 14px;">
              <option value="">All Shifts</option>
              <option value="8">8-Hour</option>
              <option value="12">12-Hour</option>
            </select>
            <select class="form-input" id="emp-filter-status" onchange="Employees.onFilterStatus(this.value)" style="width:140px; padding:10px 14px;">
              <option value="">All Status</option>
              <option value="active" selected>Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Employee</th>
                <th>ID</th>
                <th>Department</th>
                <th>Shift</th>
                <th>Shift Hours</th>
                <th>Break Quota</th>
                <th>Status</th>
                <th>Penalties Today</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="emp-table-body">
              <tr><td colspan="10" style="text-align:center; padding:40px; color:var(--text-muted);">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>`;
  },

  _bindSearch() {
    // Re-apply stored filter values if any
    const s = document.getElementById('emp-filter-status');
    if (s) s.value = this._filterStatus;
  },

  _getFiltered() {
    return STATE.employees.filter(emp => {
      const matchSearch = !this._searchTerm ||
        emp.name.toLowerCase().includes(this._searchTerm.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(this._searchTerm.toLowerCase());
      const matchShift = !this._filterShift || emp.shiftType === this._filterShift;
      const matchStatus = !this._filterStatus || emp.status === this._filterStatus;
      return matchSearch && matchShift && matchStatus;
    });
  },

  _renderTable() {
    const tbody = document.getElementById('emp-table-body');
    if (!tbody) return;

    const filtered = this._getFiltered();

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10">
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <h3>No Employees Found</h3>
          <p>Try adjusting your search or add a new employee.</p>
        </div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((emp, idx) => {
      const quota = getBreakQuota(emp.shiftType);
      const quotaText = quota.map(b => `${b.allowedMinutes}m`).join(' + ');
      const todayPenalties = STATE.penalties.filter(p =>
        p.employeeId === emp.employeeId &&
        new Date(p.date).toDateString() === new Date().toDateString()
      );
      const activeSession = getEmployeeActiveSessions(emp.employeeId);
      const isOnBreak = activeSession.length > 0;

      return `<tr>
        <td class="td-muted">${idx + 1}</td>
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px;height:36px;border-radius:10px;background:${this._avatarGrad(emp.name)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;">${emp.name.charAt(0)}</div>
            <div>
              <div style="font-weight:700; font-size:14px;">${emp.name}</div>
              ${isOnBreak ? '<span class="badge badge-cyan" style="font-size:10px;"><span class="pulse-dot" style="width:7px;height:7px;margin-right:2px;"></span>On Break</span>' : ''}
            </div>
          </div>
        </td>
        <td><span class="badge badge-purple">${emp.employeeId}</span></td>
        <td class="td-muted">${emp.department || '—'}</td>
        <td><span class="badge ${emp.shiftType === '12' ? 'badge-amber' : 'badge-cyan'}">${emp.shiftType}-Hour</span></td>
        <td class="td-muted">${emp.shiftStart || '—'} – ${emp.shiftEnd || '—'}</td>
        <td style="font-size:13px; color:var(--text-secondary);">${quotaText}</td>
        <td><span class="badge ${emp.status === 'active' ? 'badge-green' : 'badge-gray'}">${emp.status === 'active' ? '● Active' : '○ Inactive'}</span></td>
        <td>${todayPenalties.length > 0
          ? `<span class="badge badge-red">⚠️ ${todayPenalties.length} violation${todayPenalties.length > 1 ? 's' : ''}</span>`
          : '<span class="badge badge-green">✔ Clean</span>'
        }</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-ghost btn-icon btn-sm" onclick="Employees.openModal('${emp.id}')" title="Edit">✏️</button>
            <button class="btn btn-danger btn-icon btn-sm" onclick="Employees.deleteEmployee('${emp.id}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  _avatarGrad(name) {
    const grads = [
      'linear-gradient(135deg,#667eea,#764ba2)',
      'linear-gradient(135deg,#f093fb,#f5576c)',
      'linear-gradient(135deg,#4facfe,#00f2fe)',
      'linear-gradient(135deg,#43e97b,#38f9d7)',
      'linear-gradient(135deg,#fa709a,#fee140)',
      'linear-gradient(135deg,#a18cd1,#fbc2eb)',
      'linear-gradient(135deg,#ffecd2,#fcb69f)',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return grads[Math.abs(hash) % grads.length];
  },

  onSearch(val) {
    this._searchTerm = val;
    this._renderTable();
  },

  onFilterShift(val) {
    this._filterShift = val;
    this._renderTable();
  },

  onFilterStatus(val) {
    this._filterStatus = val;
    this._renderTable();
  },

  openModal(internalId) {
    const modal = document.getElementById('modal-employee');
    const title = document.getElementById('modal-employee-title');

    if (internalId) {
      const emp = getEmployeeById(internalId);
      if (!emp) return;
      title.textContent = 'Edit Employee';
      document.getElementById('emp-edit-id').value = emp.id;
      document.getElementById('emp-name').value = emp.name;
      document.getElementById('emp-id').value = emp.employeeId;
      document.getElementById('emp-shift-type').value = emp.shiftType;
      document.getElementById('emp-dept').value = emp.department || '';
      document.getElementById('emp-shift-start').value = emp.shiftStart || '09:00';
      document.getElementById('emp-shift-end').value = emp.shiftEnd || '17:00';
      document.getElementById('emp-pin').value = emp.pin || '';
      document.getElementById('emp-status').value = emp.status || 'active';
      document.getElementById('emp-id').readOnly = true;
    } else {
      title.textContent = 'Add Employee';
      document.getElementById('emp-edit-id').value = '';
      document.getElementById('emp-name').value = '';
      document.getElementById('emp-id').value = '';
      document.getElementById('emp-shift-type').value = '8';
      document.getElementById('emp-dept').value = '';
      document.getElementById('emp-shift-start').value = '09:00';
      document.getElementById('emp-shift-end').value = '17:00';
      document.getElementById('emp-pin').value = '';
      document.getElementById('emp-status').value = 'active';
      document.getElementById('emp-id').readOnly = false;
    }

    this.onShiftChange();
    modal.classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-employee').classList.add('hidden');
  },

  onShiftChange() {
    const type = document.getElementById('emp-shift-type').value;
    const quota = getBreakQuota(type);
    const text = quota.map((b, i) => `Break ${i+1}: ${b.allowedMinutes} min`).join(' &nbsp;|&nbsp; ');
    document.getElementById('quota-display').innerHTML = `${quota.length} breaks allowed: &nbsp; ${text}`;
  },

  saveEmployee() {
    const editId = document.getElementById('emp-edit-id').value;
    const name = document.getElementById('emp-name').value.trim();
    const empId = document.getElementById('emp-id').value.trim().toUpperCase();
    const shiftType = document.getElementById('emp-shift-type').value;
    const dept = document.getElementById('emp-dept').value.trim();
    const shiftStart = document.getElementById('emp-shift-start').value;
    const shiftEnd = document.getElementById('emp-shift-end').value;
    const pin = document.getElementById('emp-pin').value.trim();
    const status = document.getElementById('emp-status').value;

    if (!name || !empId) {
      Toast.show('error', 'Validation Error', 'Name and Employee ID are required.');
      return;
    }

    if (pin && !/^\d{4}$/.test(pin)) {
      Toast.show('error', 'Invalid PIN', 'PIN must be exactly 4 digits.');
      return;
    }

    // Check for duplicate ID (except when editing same employee)
    const duplicate = STATE.employees.find(e => e.employeeId === empId && e.id !== editId);
    if (duplicate) {
      Toast.show('error', 'Duplicate ID', `Employee ID "${empId}" already exists.`);
      return;
    }

    if (editId) {
      // Edit existing
      const idx = STATE.employees.findIndex(e => e.id === editId);
      if (idx === -1) return;
      const old = STATE.employees[idx];
      STATE.employees[idx] = { ...old, name, shiftType, department: dept, shiftStart, shiftEnd, pin: pin || old.pin, status };
      addAuditLog('employee_edited', 'Employee Updated', `${name} (${empId}) was updated`);
      Toast.show('success', 'Updated', `${name}'s profile has been updated.`);
    } else {
      // New employee
      const newEmp = { id: genId(), employeeId: empId, name, shiftType, department: dept, shiftStart, shiftEnd, pin: pin || '0000', status };
      STATE.employees.push(newEmp);
      addAuditLog('employee_added', 'Employee Added', `${name} (${empId}) was added to the system`);
      Toast.show('success', 'Employee Added', `${name} has been added.`);
    }

    saveState();
    this.closeModal();
    this.render();
  },

  deleteEmployee(internalId) {
    const emp = getEmployeeById(internalId);
    if (!emp) return;

    // Check if on active break
    const active = getEmployeeActiveSessions(emp.employeeId);
    if (active.length > 0) {
      Toast.show('error', 'Cannot Delete', `${emp.name} is currently on an active break. End their break first.`);
      return;
    }

    App.confirm(
      'Delete Employee',
      `Are you sure you want to delete ${emp.name} (${emp.employeeId})? All their break history and penalties will be removed.`,
      'Delete Employee',
      () => {
        STATE.employees = STATE.employees.filter(e => e.id !== internalId);
        STATE.breakSessions = STATE.breakSessions.filter(s => s.employeeId !== emp.employeeId);
        STATE.penalties = STATE.penalties.filter(p => p.employeeId !== emp.employeeId);
        addAuditLog('employee_deleted', 'Employee Deleted', `${emp.name} (${emp.employeeId}) was removed`);
        saveState();
        Toast.show('success', 'Deleted', `${emp.name} has been removed.`);
        this.render();
      }
    );
  },

  // ── Bulk Import ─────────────────────────────────────────────
  openImportModal() {
    this._importData = [];
    document.getElementById('import-preview').classList.add('hidden');
    document.getElementById('confirm-import-btn').disabled = true;
    document.getElementById('modal-import').classList.remove('hidden');
    const fi = document.getElementById('csv-file-input');
    fi.value = '';
  },

  closeImportModal() {
    document.getElementById('modal-import').classList.add('hidden');
    this._importData = [];
  },

  onDragOver(e) {
    e.preventDefault();
    document.getElementById('upload-zone').classList.add('dragover');
  },

  onDragLeave() {
    document.getElementById('upload-zone').classList.remove('dragover');
  },

  onDrop(e) {
    e.preventDefault();
    document.getElementById('upload-zone').classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) this._processFile(file);
  },

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) this._processFile(file);
  },

  _processFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        this._importData = rows.map(r => ({
          name: String(r.name || r.Name || '').trim(),
          employeeId: String(r.employee_id || r.Employee_ID || r['Employee ID'] || '').trim().toUpperCase(),
          shiftType: String(r.shift_type || r.Shift_Type || r['Shift Type'] || '8').trim(),
          shiftStart: String(r.shift_start || r.Shift_Start || '09:00').trim(),
          shiftEnd: String(r.shift_end || r.Shift_End || '17:00').trim(),
          department: String(r.department || r.Department || '').trim(),
          pin: String(r.pin || r.PIN || '0000').trim()
        })).filter(r => r.name && r.employeeId);

        this._showImportPreview();
      } catch (err) {
        Toast.show('error', 'File Error', 'Could not parse file. Make sure it is a valid CSV or Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  },

  _showImportPreview() {
    const tbody = document.getElementById('import-preview-body');
    const existing = new Set(STATE.employees.map(e => e.employeeId));

    tbody.innerHTML = this._importData.map((r, i) => {
      const isDup = existing.has(r.employeeId);
      return `<tr style="${isDup ? 'opacity:0.4;' : ''}">
        <td>${i+1}</td>
        <td>${r.name}</td>
        <td>${r.employeeId} ${isDup ? '<span class="badge badge-amber" style="font-size:10px;">Duplicate</span>' : ''}</td>
        <td>${r.shiftType}h</td>
        <td>${r.shiftStart}</td>
        <td>${r.shiftEnd}</td>
        <td>${isDup ? '<span class="badge badge-amber">Skip</span>' : '<span class="badge badge-green">Import</span>'}</td>
      </tr>`;
    }).join('');

    const newCount = this._importData.filter(r => !existing.has(r.employeeId)).length;
    document.getElementById('import-count-label').textContent =
      `${this._importData.length} rows found · ${newCount} will be imported · ${this._importData.length - newCount} duplicates will be skipped`;

    document.getElementById('import-preview').classList.remove('hidden');
    document.getElementById('confirm-import-btn').disabled = newCount === 0;
  },

  confirmImport() {
    const existing = new Set(STATE.employees.map(e => e.employeeId));
    let count = 0;
    this._importData.forEach(r => {
      if (existing.has(r.employeeId)) return;
      STATE.employees.push({
        id: genId(),
        employeeId: r.employeeId,
        name: r.name,
        shiftType: r.shiftType === '12' ? '12' : '8',
        shiftStart: r.shiftStart,
        shiftEnd: r.shiftEnd,
        department: r.department,
        pin: /^\d{4}$/.test(r.pin) ? r.pin : '0000',
        status: 'active'
      });
      count++;
    });

    saveState();
    addAuditLog('import', 'Bulk Import', `${count} employees imported via file upload`);
    Toast.show('success', 'Import Complete', `${count} employees imported successfully.`);
    this.closeImportModal();
    this.render();
  },

  downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['name', 'employee_id', 'shift_type', 'shift_start', 'shift_end', 'department', 'pin'],
      ['John Doe', 'EMP100', '8', '09:00', '17:00', 'Operations', '1234'],
      ['Jane Smith', 'EMP101', '12', '07:00', '19:00', 'Support', '5678']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'breakdesk-employee-template.xlsx');
    Toast.show('info', 'Template Downloaded', 'Fill in the template and import it back.');
  }
};
