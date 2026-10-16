// ─────────────────────────────────────────────────────────────────
// people-filter.js — BỘ LỌC CHUẨN Team + Nhân sự (CR 2026-10-16, anh Tuân chốt làm chuẩn cho mọi bộ lọc sau này)
//
// Chuẩn (xem COMPONENT_GUIDELINES.md § "Bộ lọc chuẩn Team + Nhân sự"):
//   • 2 ô chọn đặt cạnh nhau: "Tất cả team" · "Tất cả nhân sự" (class .pf-select).
//   • Nhãn nhân sự = "Username-Họ tên", chữ đầu username viết hoa (vd "Tuantt4-Trần Thế Tuân");
//     không có họ tên → chỉ "Username".
//   • Danh sách team / nhân sự lấy từ CHÍNH dữ liệu màn đó (không hiện người không có dòng nào), sắp theo tiếng Việt.
//   • Chọn team → ô nhân sự chỉ còn người của team đó; người đang chọn không thuộc team → về "Tất cả".
//   • Giá trị so khớp đã chuẩn hóa (trim + chữ thường); lọc áp cho MỌI danh sách trên màn (AND với bộ lọc khác).
//
// Dùng:
//   var pf = PeopleFilter.bind({ team: 'xxTeamFilter', user: 'xxUserFilter', onChange: render });
//   pf.setPeople([{ username, name, team }, ...]);   // gọi mỗi lần dữ liệu tải lại
//   rows.filter(function (r) { return pf.match(r.team, r.username); });   // username có thể là mảng
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // "tuantt4" + "Trần Thế Tuân" → "Tuantt4-Trần Thế Tuân"
  function label(username, name) {
    var u = String(username == null ? '' : username).trim();
    var n = String(name == null ? '' : name).trim();
    var uc = u ? u.charAt(0).toUpperCase() + u.slice(1) : '';
    if (!uc) return n || '—';
    return (n && norm(n) !== norm(u)) ? uc + '-' + n : uc;
  }

  function _fill(sel, opts, allLabel) {
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">' + esc(allLabel) + '</option>' + opts.map(function (o) {
      return '<option value="' + esc(o.v) + '">' + esc(o.t) + '</option>';
    }).join('');
    sel.value = opts.some(function (o) { return o.v === cur; }) ? cur : '';
  }
  function _cmp(a, b) { return a.t.localeCompare(b.t, 'vi'); }

  function bind(cfg) {
    var people = [];
    var teamEl = function () { return document.getElementById(cfg.team); };
    var userEl = function () { return document.getElementById(cfg.user); };

    function fillUsers() {
      var t = teamEl() ? teamEl().value : '';
      var seen = {}, opts = [];
      people.forEach(function (p) {
        var k = norm(p.username);
        if (!k || seen[k] || (t && norm(p.team) !== t)) return;
        seen[k] = 1; opts.push({ v: k, t: label(p.username, p.name) });
      });
      _fill(userEl(), opts.sort(_cmp), 'Tất cả nhân sự');
    }
    function fillTeams() {
      var seen = {}, opts = [];
      people.forEach(function (p) {
        var t = String(p.team || '').trim();
        if (t && !seen[norm(t)]) { seen[norm(t)] = 1; opts.push({ v: norm(t), t: t }); }
      });
      _fill(teamEl(), opts.sort(_cmp), 'Tất cả team');
    }

    function wire() {
      var te = teamEl(), ue = userEl();
      if (te && !te._pfBound) {
        te.addEventListener('change', function () { fillUsers(); if (cfg.onChange) cfg.onChange(); });
        te._pfBound = true;
      }
      if (ue && !ue._pfBound) {
        ue.addEventListener('change', function () { if (cfg.onChange) cfg.onChange(); });
        ue._pfBound = true;
      }
    }

    // Gộp người trùng username; ưu tiên dòng có họ tên/team.
    function setPeople(list) {
      var map = {};
      (list || []).forEach(function (p) {
        var k = norm(p && p.username);
        if (!k) return;
        var cur = map[k] || { username: p.username, name: '', team: '' };
        if (!cur.name && p.name && norm(p.name) !== k) cur.name = p.name;
        if (!cur.team && p.team) cur.team = p.team;
        map[k] = cur;
      });
      people = Object.keys(map).map(function (k) { return map[k]; });
      wire(); fillTeams(); fillUsers();
    }

    function team() { var e = teamEl(); return e ? e.value : ''; }
    function user() { var e = userEl(); return e ? e.value : ''; }
    // username: chuỗi hoặc mảng (vd việc lớn: làm chính + người được giao) — khớp nếu 1 phần tử khớp.
    function match(rowTeam, username) {
      var t = team(), u = user();
      if (t && norm(rowTeam) !== t) return false;
      if (!u) return true;
      var list = Array.isArray(username) ? username : [username];
      return list.some(function (x) { return norm(x) === u; });
    }
    function nameOf(username) {
      var k = norm(username);
      for (var i = 0; i < people.length; i++) if (norm(people[i].username) === k) return people[i].name;
      return '';
    }

    wire();
    return { setPeople: setPeople, match: match, team: team, user: user, nameOf: nameOf, refreshUsers: fillUsers };
  }

  window.PeopleFilter = { bind: bind, label: label, norm: norm };
})();
