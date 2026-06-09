/* ============================================================
   notifications.js — Alert & Notification System
   ============================================================ */

'use strict';

window.Notifications = {
  _warned: new Set(),   // session IDs that have received a warning
  _alerted: new Set(),  // session IDs that have fired an overtime alert
  _audioCtx: null,

  requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  },

  checkAlerts() {
    const active = getActiveSessions();
    const warningThreshold = (STATE.settings.warningMinutes || 2) * 60;

    active.forEach(session => {
      const elapsed = Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000);
      const remaining = session.allowedSeconds - elapsed;
      const emp = getEmployee(session.employeeId);

      // Warning: approaching break end
      if (remaining <= warningThreshold && remaining > 0 && !this._warned.has(session.id)) {
        this._warned.add(session.id);
        const name = emp?.name || session.employeeId;
        Toast.show('warning', `⏰ Break Ending Soon`, `${name}'s ${session.breakLabel} ends in ${Math.round(remaining/60)} min!`, 5000);
        this._sendBrowserNotif('⏰ Break Ending Soon', `${name}'s break ends in ${Math.round(remaining/60)} minute(s)!`);
        this._playBeep(440, 0.4, 'warning');
        this._updateTopbarAlert(`${name}'s break ends in ${Math.round(remaining/60)}m`);
      }

      // Overtime: break exceeded
      if (remaining <= 0 && !this._alerted.has(session.id)) {
        this._alerted.add(session.id);
        const name = emp?.name || session.employeeId;
        Toast.show('error', `🚨 Break Exceeded!`, `${name} has gone over ${session.breakLabel} — penalty will apply!`, 8000);
        this._sendBrowserNotif('🚨 Break Overtime!', `${name} has exceeded their break time!`);
        this._playBeep(880, 0.6, 'danger');
        this._updateTopbarAlert(`${name} is OVERTIME! Penalty pending.`);
      }
    });

    // Clear alert if no overtime
    const hasOvertime = active.some(s => {
      const elapsed = Math.floor((Date.now() - new Date(s.startTime).getTime()) / 1000);
      return elapsed > s.allowedSeconds;
    });

    if (!hasOvertime) {
      const alertEl = document.getElementById('topbar-alert');
      if (alertEl) alertEl.classList.add('hidden');
    }

    // Clean up tracked IDs for ended sessions
    const activeIds = new Set(active.map(s => s.id));
    this._warned.forEach(id => { if (!activeIds.has(id)) this._warned.delete(id); });
    this._alerted.forEach(id => { if (!activeIds.has(id)) this._alerted.delete(id); });
  },

  _updateTopbarAlert(msg) {
    const alertEl = document.getElementById('topbar-alert');
    const textEl = document.getElementById('topbar-alert-text');
    if (alertEl && textEl) {
      textEl.textContent = msg;
      alertEl.classList.remove('hidden');
    }
  },

  _sendBrowserNotif(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">☕</text></svg>'
        });
      } catch (e) {
        // Silently ignore notification errors
      }
    }
  },

  _playBeep(frequency, duration, type) {
    if (!STATE.settings.soundEnabled) return;
    try {
      if (!this._audioCtx) {
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = this._audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = type === 'danger' ? 'square' : 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);

      // For danger, play 3 beeps
      if (type === 'danger') {
        [0.15, 0.3].forEach(delay => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2);
          g2.connect(ctx.destination);
          o2.type = 'square';
          o2.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
          g2.gain.setValueAtTime(0.3, ctx.currentTime + delay);
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration * 0.5);
          o2.start(ctx.currentTime + delay);
          o2.stop(ctx.currentTime + delay + duration * 0.5);
        });
      }
    } catch (e) {
      // Audio not supported or blocked
    }
  },

  // Manual notification test (can be triggered from settings)
  testNotification() {
    Toast.show('info', '🔔 Test Notification', 'Notifications are working correctly!');
    this._playBeep(440, 0.4, 'warning');
    this._sendBrowserNotif('🔔 BreakDesk Test', 'Notifications are working!');
  }
};
