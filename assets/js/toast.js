/* ─────────────────────────────────────────
   Toast — notification component
   Fixed: multi-line support (pre-line), icon, close button
   Added: ARIA live region (set on container in HTML)
   ───────────────────────────────────────── */
var Toast = {
  _icons: {
    success: 'circle-check',
    error:   'circle-xmark',
    warning: 'triangle-exclamation',
    info:    'circle-info'
  },

  show(message, type = 'info', duration = 4500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    // Icon
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<i class="fa-solid fa-' + (this._icons[type] || 'circle-info') + '"></i>';
    icon.setAttribute('aria-hidden', 'true');

    // Message (pre-line supports \n separators — FIX BUG-03)
    const msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message; // textContent is XSS-safe; pre-line handles \n
    msg.style.whiteSpace = 'pre-line';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Đóng thông báo');
    closeBtn.addEventListener('click', () => toast.remove());

    toast.appendChild(icon);
    toast.appendChild(msg);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, duration);
    }

    return toast;
  }
};
