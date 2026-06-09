/* ============================================================
   auth.js — Authentication & Role Management
   ============================================================ */

'use strict';

window.Auth = {
  _selectedRole: 'admin',

  selectRole(role) {
    this._selectedRole = role;
    document.getElementById('tab-admin').classList.toggle('active', role === 'admin');
    document.getElementById('tab-employee').classList.toggle('active', role === 'employee');
    document.getElementById('form-admin').classList.toggle('hidden', role !== 'admin');
    document.getElementById('form-employee').classList.toggle('hidden', role !== 'employee');
  },

  loginAdmin() {
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;

    if (!username || !password) {
      Toast.show('error', 'Missing Fields', 'Please enter both username and password.');
      return;
    }

    if (username !== STATE.adminCredentials.username || password !== STATE.adminCredentials.password) {
      Toast.show('error', 'Invalid Credentials', 'Username or password is incorrect.');
      // Shake animation
      const card = document.querySelector('.login-card');
      card.style.animation = 'shake 0.4s ease';
      setTimeout(() => card.style.animation = '', 400);
      return;
    }

    STATE.currentUser = { role: 'admin', id: 'admin', name: 'Administrator' };
    sessionStorage.setItem('bd_session', JSON.stringify(STATE.currentUser));
    addAuditLog('login', 'Admin Login', `Administrator signed in`);
    Toast.show('success', 'Welcome Back!', 'Signed in as Administrator.');
    App.showApp();
  },

  loginEmployee() {
    const empId = document.getElementById('emp-login-id').value.trim().toUpperCase();
    const pin = document.getElementById('emp-login-pin').value.trim();

    if (!empId || !pin) {
      Toast.show('error', 'Missing Fields', 'Please enter your Employee ID and PIN.');
      return;
    }

    const emp = STATE.employees.find(e => e.employeeId === empId && e.status === 'active');
    if (!emp) {
      Toast.show('error', 'Not Found', 'Employee ID not found or account is inactive.');
      return;
    }

    if (emp.pin !== pin) {
      Toast.show('error', 'Wrong PIN', 'Incorrect PIN. Please try again.');
      return;
    }

    STATE.currentUser = { role: 'employee', id: emp.employeeId, name: emp.name };
    sessionStorage.setItem('bd_session', JSON.stringify(STATE.currentUser));
    addAuditLog('login', 'Employee Login', `${emp.name} (${emp.employeeId}) signed in`);
    Toast.show('success', `Welcome, ${emp.name}!`, 'Signed in as Employee.');
    App.showApp();
  },

  logout() {
    const user = STATE.currentUser;
    if (user) {
      addAuditLog('logout', 'User Logout', `${user.name} signed out`);
    }
    STATE.currentUser = null;
    sessionStorage.removeItem('bd_session');

    // Clear intervals
    if (App._globalRefreshInterval) clearInterval(App._globalRefreshInterval);

    // Reset login form
    document.getElementById('admin-username').value = '';
    document.getElementById('admin-password').value = '';
    document.getElementById('emp-login-id').value = '';
    document.getElementById('emp-login-pin').value = '';
    this.selectRole('admin');

    App.showLogin();
  }
};

// Add shake animation for wrong password
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-8px); }
    40%, 80% { transform: translateX(8px); }
  }
`;
document.head.appendChild(shakeStyle);
