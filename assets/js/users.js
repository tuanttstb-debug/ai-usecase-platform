(function () {
  'use strict';

  var _usersList = [];
  var _cache     = {};   // key → user object (for edit callbacks)

  /* ── Utilities ── */
  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function showToast(msg, type) {
    if (typeof Toast !== 'undefined') {
      Toast.show(msg, type || 'info');
    } else {
      alert(msg);
    }
  }

  /* ── Load ── */
  async function _loadUsers() {
    var wrap = document.getElementById('usersTableWrap');
    if (!wrap) return;
    wrap.innerHTML = '<p class="empty-state">Đang tải danh sách người dùng…</p>';
    try {
      _usersList = await Api.getUsers();
      _renderTable(_usersList);
    } catch (e) {
      wrap.innerHTML = '<p class="empty-state" style="color:var(--color-error)">Không tải được danh sách user. Kiểm tra GAS deployment.</p>';
    }
  }

  /* ── Render ── */
  function _renderTable(list) {
    var wrap = document.getElementById('usersTableWrap');
    if (!wrap) return;
    if (!list || !list.length) {
      wrap.innerHTML = '<p class="empty-state">Chưa có user nào. Nhấn "Đồng bộ từ UC" để import.</p>';
      return;
    }

    var rows = list.map(function (u, i) {
      var key = 'u_' + i;
      _cache[key] = u;

      var activeHtml = u.active
        ? '<span class="status-badge" style="background:rgba(76,175,80,.12);color:#388e3c">Active</span>'
        : '<span class="status-badge" style="background:rgba(244,67,54,.1);color:#c62828">Inactive</span>';

      var roleColor = { admin: '#7B2CBF', teamlead: '#1565C0', champion: '#1565C0', user: '#6D6D7A' }[u.role] || '#6D6D7A';
      var roleBg    = { admin: 'rgba(123,44,191,.12)', teamlead: 'rgba(21,101,192,.12)', champion: 'rgba(21,101,192,.12)', user: 'rgba(164,164,178,.15)' }[u.role] || 'rgba(164,164,178,.15)';
      var roleLabel = { admin: 'Admin', teamlead: 'Teamlead', champion: 'Teamlead', user: 'User' }[u.role] || esc(u.role);
      var roleHtml  = '<span class="status-badge" style="background:' + roleBg + ';color:' + roleColor + '">' + roleLabel + '</span>';

      var lastLogin = u.last_login ? u.last_login.split('T')[0] : '—';

      return '<tr>' +
        '<td style="font-weight:600;font-family:monospace;font-size:var(--text-sm)">' + esc(u.username) + '</td>' +
        '<td>' + esc(u.display_name || '—') + '</td>' +
        '<td>' + roleHtml + '</td>' +
        '<td>' + esc(u.team || '—') + '</td>' +
        '<td>' + activeHtml + '</td>' +
        '<td style="color:var(--color-text-secondary);font-size:var(--text-xs)">' + lastLogin + '</td>' +
        '<td><button class="btn btn--ghost btn--sm" onclick="UsersPage._edit(\'' + key + '\')" title="Chỉnh sửa">Sửa</button></td>' +
        '</tr>';
    }).join('');

    wrap.innerHTML =
      '<div style="overflow-x:auto">' +
      '<table class="data-table" style="min-width:640px">' +
      '<thead><tr>' +
        '<th>Username</th><th>Tên hiển thị</th><th>Vai trò</th><th>Team</th><th>Trạng thái</th><th>Đăng nhập cuối</th><th></th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table></div>' +
      '<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-3)">' +
        list.length + ' user · Username so sánh không phân biệt hoa thường' +
      '</p>';
  }

  /* ── Modal ── */
  function _openModal(userData) {
    var modal = document.getElementById('userModal');
    if (!modal) return;
    var isEdit = !!userData;
    document.getElementById('userModalTitle').textContent = isEdit ? 'Chỉnh sửa người dùng' : 'Thêm người dùng';
    document.getElementById('umUsername').value    = isEdit ? (userData.username || '') : '';
    document.getElementById('umUsername').readOnly = isEdit;
    document.getElementById('umDisplayName').value = isEdit ? (userData.display_name || '') : '';
    document.getElementById('umEmail').value       = isEdit ? (userData.email || '') : '';
    // Role: map champion (dữ liệu cũ) → teamlead cho dropdown
    var roleVal = isEdit ? (userData.role || 'user') : 'user';
    if (roleVal === 'champion') roleVal = 'teamlead';
    document.getElementById('umRole').value        = roleVal;
    document.getElementById('umTeam').value        = isEdit ? (userData.team || '') : '';
    document.getElementById('umActive').checked    = isEdit ? !!userData.active : true;

    // Mật khẩu: tạo mới = bắt buộc; sửa = đặt lại (để trống nếu không đổi)
    var passEl = document.getElementById('umPassword');
    if (passEl) passEl.value = '';
    var passLabel = document.getElementById('umPasswordLabel');
    var passReq   = document.getElementById('umPasswordReq');
    var passHint  = document.getElementById('umPasswordHint');
    if (passLabel) passLabel.textContent = isEdit ? 'Đặt lại mật khẩu' : 'Mật khẩu';
    if (passReq)   passReq.style.display  = isEdit ? 'none' : '';
    if (passHint)  passHint.textContent   = isEdit
      ? 'Để trống nếu không đổi mật khẩu.'
      : 'Tối thiểu 6 ký tự. Mặc định nên đặt = username.';

    modal.classList.remove('hidden');
  }

  function _closeModal() {
    var modal = document.getElementById('userModal');
    if (modal) modal.classList.add('hidden');
  }

  async function _saveUser() {
    var user = AuthService.getUser();
    if (!user || user.role !== 'admin') return;

    var uname = (document.getElementById('umUsername').value || '').trim();
    if (!uname) { showToast('Vui lòng nhập tên đăng nhập', 'error'); return; }

    var isEdit = document.getElementById('umUsername').readOnly;
    var pass   = (document.getElementById('umPassword').value || '');
    if (!isEdit && pass.length < 6) {
      showToast('Vui lòng nhập mật khẩu (tối thiểu 6 ký tự) cho user mới', 'error'); return;
    }
    if (pass && pass.length < 6) {
      showToast('Mật khẩu mới phải có ít nhất 6 ký tự', 'error'); return;
    }

    var saveBtn = document.getElementById('userModalSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu…';

    try {
      var payload = {
        Username:       uname,
        Display_Name:   (document.getElementById('umDisplayName').value || '').trim(),
        Email:          (document.getElementById('umEmail').value || '').trim(),
        Role:           document.getElementById('umRole').value,
        Team:           (document.getElementById('umTeam').value || '').trim(),
        Active:         document.getElementById('umActive').checked,
        reviewer_email: user.email
      };
      if (!isEdit) payload.Password = pass;   // tạo mới cần mật khẩu
      var res = await Api.upsertUser(payload);
      // Sửa + có nhập mật khẩu mới → đặt lại mật khẩu riêng
      if (isEdit && pass) {
        await Api.resetUserPassword({ Username: uname, new_password: pass, reviewer_email: user.email });
      }
      showToast(res.created ? 'Đã thêm user "' + uname + '"' : 'Đã cập nhật user "' + uname + '"', 'success');
      _closeModal();
      await _loadUsers();
    } catch (e) {
      showToast('Lỗi lưu user: ' + (e.message || e), 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Lưu';
    }
  }

  /* ── Bind ── */
  function _bind() {
    // Sync button
    var syncBtn = document.getElementById('syncUsersBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', async function () {
        var u = AuthService.getUser();
        if (!u || u.role !== 'admin') return;
        syncBtn.disabled = true;
        syncBtn.textContent = 'Đang đồng bộ…';
        try {
          var res = await Api.syncUsers(u.email);
          showToast('Đồng bộ xong: +' + (res.synced || 0) + ' user mới, ' + (res.skipped || 0) + ' đã có', 'success');
          await _loadUsers();
        } catch (e) {
          showToast('Lỗi sync: ' + (e.message || e), 'error');
        } finally {
          syncBtn.disabled = false;
          syncBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14" style="vertical-align:middle;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>Đồng bộ từ UC';
        }
      });
    }

    // Add user button
    var addBtn = document.getElementById('addUserBtn');
    if (addBtn) addBtn.addEventListener('click', function () { _openModal(null); });

    // Modal close
    var closeBtn  = document.getElementById('userModalCloseBtn');
    var cancelBtn = document.getElementById('userModalCancelBtn');
    if (closeBtn)  closeBtn.addEventListener('click',  _closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', _closeModal);

    var saveBtn = document.getElementById('userModalSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', _saveUser);

    var modal = document.getElementById('userModal');
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) _closeModal(); });
  }

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', function () {
    _bind();
    _loadUsers();
  });

  /* ── Public API ── */
  window.UsersPage = {
    _edit: function (key) {
      var u = _cache[key];
      if (u) _openModal(u);
    }
  };

})();
