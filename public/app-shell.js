(() => {
  const rawPath = location.pathname.split('/').pop() || 'index.html';
  const path = rawPath.endsWith('.html') ? rawPath : `${rawPath}.html`;
  if (document.body.classList.contains('dashboard-page') || ['login.html','register.html'].includes(path)) return;

  document.body.classList.add('app-page');
  document.querySelectorAll('.nav-links').forEach((el) => el.remove());

  const items = [
    ['index.html', '⌂', 'لوحة التحكم'], ['my-quizzes.html', '▣', 'اختباراتي'],
    ['practice.html', '◎', 'التدريب الحر'], ['daily.html', '◷', 'سؤال اليوم'],
    ['mistakes.html', '✓', 'بنك أخطائي'], ['history.html', '↺', 'السجل'],
    ['classes.html', '⌘', 'فصولي'], ['community.html', '✦', 'الساحة العامة'],
    ['leaderboard.html', '♛', 'الصدارة'],
  ];
  const current = path || 'index.html';
  const links = items.map(([href, icon, label]) => `<a class="global-side-link ${current === href ? 'active' : ''}" href="${href}" aria-current="${current === href ? 'page' : 'false'}"><span aria-hidden="true">${icon}</span>${label}</a>`).join('');
  const sidebar = document.createElement('aside');
  sidebar.className = 'global-sidebar';
  sidebar.innerHTML = `<div class="global-brand"><span class="brand-mark">M</span><div><strong>Musical Fishstick</strong><small>ملتقى الطلاب</small></div></div><p class="global-caption">التنقل الرئيسي</p><nav>${links}</nav><div class="global-side-bottom"><a href="quiz-create.html" class="global-create">＋ إنشاء اختبار</a><button id="globalLogout" class="global-logout">تسجيل الخروج</button></div>`;
  document.body.prepend(sidebar);

  const topbar = document.createElement('header');
  topbar.className = 'global-topbar';
  topbar.innerHTML = `<button class="global-menu-btn" id="globalMenuBtn" aria-label="فتح القائمة">☰</button><a class="global-mobile-brand" href="index.html"><span class="brand-mark small">M</span><strong>ملتقى الطلاب</strong></a><div class="global-account"><a href="community.html">◌</a><span class="global-avatar" id="globalAvatar">؟</span><span id="globalUser">جاري التحقق...</span></div>`;
  document.body.prepend(topbar);

  const drawer = document.createElement('div');
  drawer.className = 'global-drawer';
  drawer.id = 'globalDrawer';
  drawer.innerHTML = `<div class="global-drawer-head"><strong>ملتقى الطلاب</strong><button id="globalClose" aria-label="إغلاق القائمة">×</button></div>${links}<a href="quiz-create.html" class="global-create">＋ إنشاء اختبار</a><button id="globalMobileLogout" class="global-logout">تسجيل الخروج</button>`;
  document.body.appendChild(drawer);
  const overlay = document.createElement('div'); overlay.className = 'global-overlay'; overlay.id = 'globalOverlay'; document.body.appendChild(overlay);

  const openDrawer = () => {
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.classList.add('drawer-open');
  };
  const close = () => {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.classList.remove('drawer-open');
  };
  document.getElementById('globalMenuBtn').addEventListener('click', openDrawer);
  document.getElementById('globalClose').addEventListener('click', close);
  overlay.addEventListener('click', close);
  drawer.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); location.href = 'login.html'; };
  document.getElementById('globalLogout').addEventListener('click', logout); document.getElementById('globalMobileLogout').addEventListener('click', logout);

  fetch('/api/auth/me').then((r) => {
    if (!r.ok) throw new Error('auth endpoint unavailable');
    return r.json();
  }).then((data) => {
    const u = data.user;
    if (!u) { document.getElementById('globalUser').innerHTML = '<a href="login.html">تسجيل الدخول</a>'; document.getElementById('globalLogout').style.display = 'none'; document.getElementById('globalMobileLogout').style.display = 'none'; return; }
    document.getElementById('globalUser').textContent = u.name || 'حسابي'; document.getElementById('globalAvatar').textContent = (u.name || '؟').charAt(0);
  }).catch(() => { document.getElementById('globalUser').textContent = 'حسابي'; });
})();
