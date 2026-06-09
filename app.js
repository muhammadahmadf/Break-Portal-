/* ============================================================
   app.js — Core State, Router, Utilities
   ============================================================ */

'use strict';

// ── Global State ─────────────────────────────────────────────
window.STATE = {
  employees: [],
  breakSessions: [],   // all break sessions (historical + active)
  penalties: [],
  auditLog: [],
  currentUser: null,   // { role: 'admin'|'employee', id: null|employeeId, name: string }
  adminCredentials: { username: 'admin', password: 'admin123' },
  settings: {
    penaltyAmount: 500,
    warningMinutes: 2,
    autoLogoutMinutes: 30,
    soundEnabled: true,
    currency: '₹'
  }
};

// ── Persistence ──────────────────────────────────────────────
const STORAGE_KEY = 'breakdesk_v1';

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      employees: STATE.employees,
      breakSessions: STATE.breakSessions,
      penalties: STATE.penalties,
      auditLog: STATE.auditLog,
      adminCredentials: STATE.adminCredentials,
      settings: STATE.settings
    }));
  } catch (e) {
    console.warn('State save failed:', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    STATE.employees = data.employees || [];
    STATE.breakSessions = data.breakSessions || [];
    STATE.penalties = data.penalties || [];
    STATE.auditLog = data.auditLog || [];
    if (data.adminCredentials) STATE.adminCredentials = data.adminCredentials;
    if (data.settings) STATE.settings = { ...STATE.settings, ...data.settings };
  } catch (e) {
    console.warn('State load failed:', e);
  }
}

// ── Seed Demo Data ───────────────────────────────────────────
function seedDemoData() {
  if (STATE.employees.length > 0) return;

  const demoEmployees = [
    { id: genId(), employeeId: 'EMP001', name: 'Sarah Johnson', shiftType: '8', shiftStart: '09:00', shiftEnd: '17:00', department: 'Operations', pin: '1234', status: 'active' },
    { id: genId(), employeeId: 'EMP002', name: 'Michael Chen', shiftType: '12', shiftStart: '07:00', shiftEnd: '19:00', department: 'Support', pin: '2345', status: 'active' },
    { id: genId(), employeeId: 'EMP003', name: 'Priya Sharma', shiftType: '8', shiftStart: '10:00', shiftEnd: '18:00', department: 'HR', pin: '3456', status: 'active' },
    { id: genId(), employeeId: 'EMP004', name: 'James Wilson', shiftType: '12', shiftStart: '19:00', shiftEnd: '07:00', department: 'Security', pin: '4567', status: 'active' },
    { id: genId(), employeeId: 'EMP005', name: 'Ayesha Khan', shiftType: '8', shiftStart: '08:00', shiftEnd: '16:00', department: 'Finance', pin: '5678', status: 'active' },
  ];

  STATE.employees = demoEmployees;

  // Seed some past penalties
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  STATE.penalties = [
    {
      id: genId(),
      employeeId: 'EMP002',
      sessionId: 'demo-1',
      date: yesterday.toISOString(),
      excessSeconds: 480,
      amount: 500,
      breakLabel: 'Break 1 (20 min)',
      reason: 'Exceeded break time by 8 minutes'
    },
    {
      id: genId(),
      employeeId: 'EMP004',
      sessionId: 'demo-2',
      date: yesterday.toISOString(),
      excessSeconds: 720,
      amount: 500,
      breakLabel: 'Break 2 (30 min)',
      reason: 'Exceeded break time by 12 minutes'
    }
  ];

  // Seed some break sessions for reporting
  STATE.breakSessions = [
    {
      id: 'demo-1',
      employeeId: 'EMP002',
      breakIndex: 0,
      breakLabel: 'Break 1 (20 min)',
      allowedSeconds: 1200,
      startTime: new Date(yesterday.getTime() + 4*3600*1000).toISOString(),
      endTime: new Date(yesterday.getTime() + 4*3600*1000 + 28*60*1000).toISOString(),
      durationSeconds: 1680,
      status: 'completed',
      penaltyApplied: true
    },
    {
      id: 'demo-2',
      employeeId: 'EMP004',
      breakIndex: 1,
      breakLabel: 'Break 2 (30 min)',
      allowedSeconds: 1800,
      startTime: new Date(yesterday.getTime() + 6*3600*1000).toISOString(),
      endTime: new Date(yesterday.getTime() + 6*3600*1000 + 42*60*1000).toISOString(),
      durationSeconds: 2520,
      status: 'completed',
      penaltyApplied: true
    },
    {
      id: 'demo-3',
      employeeId: 'EMP001',
      breakIndex: 0,
      breakLabel: 'Break 1 (20 min)',
      allowedSeconds: 1200,
      startTime: new Date(yesterday.getTime() + 3*3600*1000).toISOString(),
      endTime: new Date(yesterday.getTime() + 3*3600*1000 + 18*60*1000).toISOString(),
      durationSeconds: 1080,
      status: 'completed',
      penaltyApplied: false
    }
  ];

  addAuditLog('system', 'Demo Data Loaded', 'System seeded with 5 demo employees');
  saveState();
}

// ── Utilities ─────────────────────────────────────────────────
function genId() {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

function formatTime(seconds) {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = seconds < 0 ? '-' : '';
  return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(amount) {
  return `${STATE.settings.currency}${amount.toLocaleString('en-IN')}`;
}

function getBreakQuota(shiftType) {
  if (shiftType === '12') {
    return [
      { label: 'Break 1', allowedMinutes: 20 },
      { label: 'Break 2', allowedMinutes: 20 },
      { label: 'Break 3', allowedMinutes: 30 }
    ];
  }
  // 8-hour
  return [
    { label: 'Break 1', allowedMinutes: 20 },
    { label: 'Break 2', allowedMinutes: 30 }
  ];
}

function getEmployee(employeeId) {
  return STATE.employees.find(e => e.employeeId === employeeId);
}

function getEmployeeById(id) {
  return STATE.employees.find(e => e.id === id);
}

function getActiveSessions() {
  return STATE.breakSessions.filter(s => s.status === 'active');
}

function getEmployeeActiveSessions(employeeId) {
  return STATE.breakSessions.filter(s => s.employeeId === employeeId && s.status === 'active');
}

function getEmployeeCompletedSessions(employeeId, dateStr) {
  return STATE.breakSessions.filter(s => {
    if (s.employeeId !== employeeId || s.status !== 'completed') return false;
    if (dateStr) {
      return new Date(s.startTime).toDateString() === new Date(dateStr).toDateString();
    }
    return true;
  });
}

function getTodayPenalties() {
  const today = new Date().toDateString();
  return STATE.penalties.filter(p => new Date(p.date).toDateString() === today);
}

function addAuditLog(action, title, detail) {
  STATE.auditLog.unshift({
    id: genId(),
    timestamp: new Date().toISOString(),
    action,
    title,
    detail,
    userId: STATE.currentUser ? STATE.currentUser.id : 'system'
  });
  // Keep max 500 entries
  if (STATE.auditLog.length > 500) STATE.auditLog.splice(500);
  saveState();
}

// ── Activity & Auto-logout ────────────────────────────────────
let _lastActivity = Date.now();
let _autoLogoutTimer = null;

function resetActivity() {
  _lastActivity = Date.now();
}

function startAutoLogoutTimer() {
  if (_autoLogoutTimer) clearInterval(_autoLogoutTimer);
  _autoLogoutTimer = setInterval(() => {
    const mins = (Date.now() - _lastActivity) / 60000;
    if (mins >= STATE.settings.autoLogoutMinutes) {
      Auth.logout();
      Toast.show('warning', 'Auto Logout', 'You were signed out due to inactivity.');
    }
  }, 30000);
}

document.addEventListener('click', resetActivity);
document.addEventListener('keydown', resetActivity);

// ── Router ────────────────────────────────────────────────────
const VIEWS = {
  dashboard: { title: '📊 Dashboard', fn: () => Dashboard.render() },
  employees: { title: '👥 Employees', fn: () => Employees.render() },
  breaks:    { title: '⏸️ Break Tracker', fn: () => Breaks.render() },
  penalties: { title: '⚠️ Penalties', fn: () => Penalties.render() },
  reports:   { title: '📋 Reports', fn: () => Reports.render() },
  analytics: { title: '📈 Analytics', fn: () => Charts.render() },
  audit:     { title: '📝 Audit Log', fn: () => App.renderAudit() },
  settings:  { title: '⚙️ Settings', fn: () => App.renderSettings() },
};

// ── App Controller ────────────────────────────────────────────
window.App = {
  currentView: 'dashboard',
  _sidebarOpen: false,
  _clockInterval: null,
  _globalRefreshInterval: null,
  _pendingConfirm: null,
  _importData: [],

  init() {
    loadState();
    seedDemoData();
    this.startClock();

    // Check if session exists in sessionStorage
    const session = sessionStorage.getItem('bd_session');
    if (session) {
      try {
        STATE.currentUser = JSON.parse(session);
        this.showApp();
      } catch {
        this.showLogin();
      }
    } else {
      this.showLogin();
    }
  },

  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').classList.add('hidden');
  },

  showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    this.updateSidebarUser();
    this.applyRoleRestrictions();
    this.navigate('dashboard');
    this.startGlobalRefresh();
    startAutoLogoutTimer();
    Notifications.requestPermission();
  },

  updateSidebarUser() {
    const user = STATE.currentUser;
    if (!user) return;
    document.getElementById('user-display-name').textContent = user.name;
    document.getElementById('user-role-badge').textContent = user.role === 'admin' ? 'Administrator' : 'Employee';
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
  },

  applyRoleRestrictions() {
    const isEmployee = STATE.currentUser?.role === 'employee';
    const adminSections = document.querySelectorAll('#admin-nav-section, #admin-only-nav');
    if (isEmployee) {
      document.getElementById('nav-employees').classList.add('hidden');
      document.getElementById('nav-penalties').classList.add('hidden');
      document.getElementById('nav-audit').classList.add('hidden');
      document.getElementById('nav-settings').classList.add('hidden');
      adminSections.forEach(s => s.classList.add('hidden'));
    } else {
      document.getElementById('nav-employees').classList.remove('hidden');
      document.getElementById('nav-penalties').classList.remove('hidden');
      document.getElementById('nav-audit').classList.remove('hidden');
      document.getElementById('nav-settings').classList.remove('hidden');
      adminSections.forEach(s => s.classList.remove('hidden'));
    }
  },

  navigate(view) {
    if (!VIEWS[view]) return;

    // Employee restriction
    const isEmployee = STATE.currentUser?.role === 'employee';
    const restricted = ['employees', 'penalties', 'audit', 'settings'];
    if (isEmployee && restricted.includes(view)) {
      Toast.show('error', 'Access Denied', 'You do not have permission to view this page.');
      return;
    }

    this.currentView = view;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navEl = document.getElementById(`nav-${view}`);
    if (navEl) navEl.classList.add('active');

    const titleRaw = VIEWS[view].title;
    // Strip emoji for display
    document.getElementById('topbar-title').textContent = titleRaw.replace(/^\S+\s/, '');

    const container = document.getElementById('view-container');
    container.innerHTML = '';
    try { VIEWS[view].fn(); } catch (e) { console.error('View error:', e); }

    // Close sidebar on mobile
    if (window.innerWidth <= 900) {
      document.getElementById('sidebar').classList.remove('open');
    }
  },

  startClock() {
    const el = document.getElementById('topbar-clock');
    const tick = () => {
      el.textContent = new Date().toLocaleTimeString('en-IN', { hour12: true });
    };
    tick();
    this._clockInterval = setInterval(tick, 1000);
  },

  startGlobalRefresh() {
    if (this._globalRefreshInterval) clearInterval(this._globalRefreshInterval);
    this._globalRefreshInterval = setInterval(() => {
      // Update active break badges
      const active = getActiveSessions().length;
      const badge = document.getElementById('active-breaks-badge');
      if (badge) {
        badge.textContent = active;
        badge.classList.toggle('hidden', active === 0);
      }

      // Update penalties badge
      const todayPen = getTodayPenalties().length;
      const penBadge = document.getElementById('penalties-badge');
      if (penBadge) {
        penBadge.textContent = todayPen;
        penBadge.classList.toggle('hidden', todayPen === 0);
      }

      // Check alerts
      Notifications.checkAlerts();

      // Auto-refresh certain views
      if (this.currentView === 'dashboard') Dashboard.refresh();
      if (this.currentView === 'breaks') Breaks.refreshTimers();
    }, 1000);
  },

  toggleSidebar() {
    this._sidebarOpen = !this._sidebarOpen;
    document.getElementById('sidebar').classList.toggle('open', this._sidebarOpen);
  },

  confirm(title, msg, btnText, callback, btnClass = 'btn-danger') {
    document.getElementById('modal-confirm-title').textContent = title;
    document.getElementById('modal-confirm-msg').textContent = msg;
    const btn = document.getElementById('confirm-action-btn');
    btn.textContent = btnText;
    btn.className = `btn ${btnClass}`;
    this._pendingConfirm = callback;
    btn.onclick = () => { this._pendingConfirm?.(); this.closeConfirm(); };
    document.getElementById('modal-confirm').classList.remove('hidden');
  },

  closeConfirm() {
    document.getElementById('modal-confirm').classList.add('hidden');
    this._pendingConfirm = null;
  },

  renderAudit() {
    const container = document.getElementById('view-container');
    const logs = STATE.auditLog;

    const actionColors = {
      'employee_added': 'var(--green)',
      'employee_edited': 'var(--cyan)',
      'employee_deleted': 'var(--red)',
      'break_started': 'var(--cyan)',
      'break_ended': 'var(--purple)',
      'penalty_applied': 'var(--red)',
      'login': 'var(--green)',
      'logout': 'var(--amber)',
      'system': 'var(--text-muted)',
      'import': 'var(--purple)',
      'report': 'var(--amber)',
      'settings': 'var(--cyan)'
    };

    const items = logs.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📝</div><h3>No Audit Entries</h3><p>Actions will be logged here.</p></div>`
      : logs.map(l => `
        <div class="audit-item">
          <div class="audit-dot" style="background:${actionColors[l.action] || 'var(--text-muted)'}"></div>
          <div style="flex:1;">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <span class="audit-action">${l.title}</span>
              <span class="audit-time">${formatDateTime(l.timestamp)}</span>
            </div>
            <div class="audit-detail">${l.detail}</div>
          </div>
        </div>`).join('');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Audit Log</h2>
          <p>Chronological record of all system actions</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-ghost btn-sm" onclick="App.clearAuditLog()">🗑️ Clear Log</button>
        </div>
      </div>
      <div class="section-card">
        <div class="section-header">
          <div class="section-title"><span class="title-icon">📝</span> Activity Log (${logs.length} entries)</div>
        </div>
        <div class="section-body" style="max-height:600px; overflow-y:auto;">
          ${items}
        </div>
      </div>`;
  },

  clearAuditLog() {
    this.confirm('Clear Audit Log', 'Are you sure? This will permanently delete all audit entries.', 'Clear All', () => {
      STATE.auditLog = [];
      saveState();
      this.navigate('audit');
      Toast.show('success', 'Cleared', 'Audit log has been cleared.');
    });
  },

  renderSettings() {
    const s = STATE.settings;
    const c = STATE.adminCredentials;
    document.getElementById('view-container').innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h2>Settings</h2><p>Configure system preferences</p></div>
      </div>

      <div class="two-col">
        <div>
          <div class="section-card mb-16">
            <div class="section-header"><div class="section-title"><span class="title-icon">💰</span> Penalty Settings</div></div>
            <div class="section-body">
              <div class="form-group">
                <label class="form-label">Penalty Amount (₹ per violation)</label>
                <input class="form-input" type="number" id="set-penalty" value="${s.penaltyAmount}" min="0">
              </div>
              <div class="form-group">
                <label class="form-label">Warning Before Break Ends (minutes)</label>
                <input class="form-input" type="number" id="set-warning" value="${s.warningMinutes}" min="1" max="10">
              </div>
              <div class="form-group">
                <label class="form-label">Currency Symbol</label>
                <input class="form-input" type="text" id="set-currency" value="${s.currency}" maxlength="3">
              </div>
            </div>
          </div>

          <div class="section-card">
            <div class="section-header"><div class="section-title"><span class="title-icon">🔔</span> Notifications</div></div>
            <div class="section-body">
              <div class="form-group" style="display:flex;align-items:center;justify-content:space-between;">
                <label class="form-label" style="margin:0;">Sound Alerts</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;">
                  <input type="checkbox" id="set-sound" ${s.soundEnabled ? 'checked' : ''}
                    style="width:18px;height:18px;accent-color:var(--cyan);">
                  <span style="color:var(--text-secondary); font-size:13px;">Enabled</span>
                </label>
              </div>
              <div class="form-group">
                <label class="form-label">Auto-Logout After (minutes)</label>
                <input class="form-input" type="number" id="set-autologout" value="${s.autoLogoutMinutes}" min="5" max="120">
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="section-card mb-16">
            <div class="section-header"><div class="section-title"><span class="title-icon">🔐</span> Admin Credentials</div></div>
            <div class="section-body">
              <div class="form-group">
                <label class="form-label">Admin Username</label>
                <input class="form-input" type="text" id="set-username" value="${c.username}">
              </div>
              <div class="form-group">
                <label class="form-label">New Password</label>
                <input class="form-input" type="password" id="set-password" placeholder="Leave blank to keep current">
              </div>
              <div class="form-group">
                <label class="form-label">Confirm New Password</label>
                <input class="form-input" type="password" id="set-password2" placeholder="Repeat new password">
              </div>
            </div>
          </div>

          <div class="section-card">
            <div class="section-header"><div class="section-title"><span class="title-icon">🗄️</span> Data Management</div></div>
            <div class="section-body">
              <div style="display:flex; flex-direction:column; gap:10px;">
                <button class="btn btn-ghost" onclick="App.exportAllData()">📤 Export All Data (JSON)</button>
                <button class="btn btn-danger" onclick="App.resetAllData()">⚠️ Reset All Data</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="text-align:right; margin-top:16px;">
        <button class="btn btn-primary" onclick="App.saveSettings()">💾 Save Settings</button>
      </div>`;
  },

  saveSettings() {
    const penalty = parseInt(document.getElementById('set-penalty').value) || 500;
    const warning = parseInt(document.getElementById('set-warning').value) || 2;
    const currency = document.getElementById('set-currency').value.trim() || '₹';
    const sound = document.getElementById('set-sound').checked;
    const autoLogout = parseInt(document.getElementById('set-autologout').value) || 30;
    const username = document.getElementById('set-username').value.trim();
    const password = document.getElementById('set-password').value;
    const password2 = document.getElementById('set-password2').value;

    STATE.settings.penaltyAmount = penalty;
    STATE.settings.warningMinutes = warning;
    STATE.settings.currency = currency;
    STATE.settings.soundEnabled = sound;
    STATE.settings.autoLogoutMinutes = autoLogout;

    if (username) STATE.adminCredentials.username = username;
    if (password) {
      if (password !== password2) {
        Toast.show('error', 'Password Mismatch', 'New passwords do not match.');
        return;
      }
      STATE.adminCredentials.password = password;
    }

    saveState();
    addAuditLog('settings', 'Settings Updated', `Penalty: ${currency}${penalty}, Warning: ${warning}min, AutoLogout: ${autoLogout}min`);
    Toast.show('success', 'Settings Saved', 'Your settings have been updated.');
  },

  exportAllData() {
    const data = {
      exportedAt: new Date().toISOString(),
      employees: STATE.employees,
      breakSessions: STATE.breakSessions,
      penalties: STATE.penalties,
      auditLog: STATE.auditLog
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breakdesk-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addAuditLog('report', 'Data Export', 'Full data exported as JSON');
    Toast.show('success', 'Exported', 'All data exported successfully.');
  },

  resetAllData() {
    this.confirm(
      '⚠️ Reset All Data',
      'This will permanently delete ALL employees, sessions, and penalties. This cannot be undone!',
      'Yes, Reset Everything',
      () => {
        STATE.employees = [];
        STATE.breakSessions = [];
        STATE.penalties = [];
        STATE.auditLog = [];
        saveState();
        Toast.show('warning', 'Data Reset', 'All data has been cleared.');
        this.navigate('dashboard');
      }
    );
  }
};

// ── Toast Notification System ─────────────────────────────────
window.Toast = {
  show(type, title, msg, duration = 4000) {
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      </div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:0 4px;">✕</button>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }
};

// Export globals needed by other modules
window.saveState = saveState;
window.genId = genId;
window.formatTime = formatTime;
window.formatDuration = formatDuration;
window.formatDateTime = formatDateTime;
window.formatDate = formatDate;
window.formatCurrency = formatCurrency;
window.getBreakQuota = getBreakQuota;
window.getEmployee = getEmployee;
window.getEmployeeById = getEmployeeById;
window.getActiveSessions = getActiveSessions;
window.getEmployeeActiveSessions = getEmployeeActiveSessions;
window.getEmployeeCompletedSessions = getEmployeeCompletedSessions;
window.getTodayPenalties = getTodayPenalties;
window.addAuditLog = addAuditLog;
