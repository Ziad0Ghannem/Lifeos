'use strict';
(function () {
  const { h } = L;
  const NAV = [
    ['/dashboard', '◉', 'Overview Dashboard'], ['/goals', '◎', 'Goals'], ['/daily', '☰', 'Daily Tracker'], ['/tasks', '☑', 'Tasks'], ['/habits', '↻', 'Habits'], ['/calendar', '▦', 'Calendar'], ['/kpis', '◭', 'KPIs and Analytics'],
    ['finance', '◈', 'Personal Finance', [['/finance', 'Finance Overview'], ['/finance/transactions', 'Transactions'], ['/finance/income', 'Income'], ['/finance/expenses', 'Expenses'], ['/finance/budgets', 'Budgets'], ['/finance/categories', 'Categories'], ['/finance/commitments', 'Financial Commitments'], ['/finance/savings', 'Savings Goals'], ['/finance/portfolio', 'Investment Portfolio'], ['/finance/reports', 'Financial Reports']]],
    ['/reviews', '✎', 'Reviews'], ['/reports', '▤', 'Reports'], ['/data', '⛁', 'Data and Backups'], ['/settings', '⚙', 'Settings']
  ];
  let currentDate = L.today(); let financeOpen = false;

  L.markNav = (path) => {
    L.$$('#sidebar a[data-path]').forEach(a => { const p = a.dataset.path; const active = p === path || (p !== '/finance' && p !== '/dashboard' && path.startsWith(p + '/')) || (p === '/finance' && path === '/finance'); a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const fin = path.startsWith('/finance'); const sub = L.$('#sub-finance'); const btn = L.$('#btn-finance'); if (sub && (fin || financeOpen)) { sub.classList.add('open'); btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    L.$('#sidebar').classList.remove('mobile-open');
  };

  L.buildChrome = () => {
    const sb = L.$('#sidebar'); sb.setAttribute('aria-label', L.t('Main navigation')); const collapsed = localStorage.getItem('lifeos_sidebar') === '1'; sb.classList.toggle('collapsed', collapsed);
    const items = NAV.map(([path, icon, label, subs]) => {
      if (!subs) return h('a', { href: '#' + path, dataset: { path }, title: L.t(label) }, h('span', { class: 'ico' }, icon), h('span', { class: 'nav-label' }, L.t(label)));
      const btn = h('button', { class: 'navbtn' + (financeOpen ? ' open' : ''), id: 'btn-finance', 'aria-expanded': String(financeOpen), 'aria-controls': 'sub-finance', title: L.t(label), onclick: () => { financeOpen = !financeOpen; if (collapsed) { L.go('/finance'); return; } L.$('#sub-finance').classList.toggle('open', financeOpen); btn.classList.toggle('open', financeOpen); btn.setAttribute('aria-expanded', String(financeOpen)); } }, h('span', { class: 'ico' }, icon), h('span', { class: 'nav-label' }, L.t(label)), h('span', { class: 'chev' }, '›'));
      return h('div', {}, btn, h('div', { class: 'sub' + (financeOpen ? ' open' : ''), id: 'sub-finance' }, subs.map(([p, l]) => h('a', { href: '#' + p, dataset: { path: p } }, L.t(l)))));
    });
    L.mount(sb, h('div', { class: 'brand' }, h('div', { class: 'logo' }, 'L'), h('span', { class: 'brand-name' }, 'LifeOS')), h('nav', { class: 'nav' }, items),
      h('div', { class: 'sb-foot' }, h('button', { class: 'btn ghost', style: 'width:100%', 'aria-label': 'Collapse sidebar', onclick: () => { const c = !sb.classList.contains('collapsed'); localStorage.setItem('lifeos_sidebar', c ? '1' : '0'); L.buildChrome(); L.markNav(L.parseHash().path); } }, collapsed ? '»' : '« Collapse')));
    const tb = L.$('#topbar'); const d = L.today();
    const theme = L.settings.theme === 'light' ? 'dark' : 'light';
    L.mount(tb, h('button', { class: 'btn icon ghost', id: 'menu-btn', 'aria-label': 'Open menu', style: 'display:none', onclick: () => sb.classList.toggle('mobile-open') }, '☰'), h('span', { class: 'date', id: 'today-label' }, L.fmtDate(d, true)), h('span', { class: 'sp' }),
      h('button', { class: 'btn primary', onclick: () => L.openExpense(), title: 'Alt+E' }, '+ ' + L.t('Add expense')), h('button', { class: 'btn', onclick: () => L.openIncome(), title: 'Alt+I' }, '+ ' + L.t('Add income')), h('button', { class: 'btn', onclick: () => L.openInvest(), title: 'Alt+V' }, '+ Invest'), h('button', { class: 'btn', onclick: () => L.taskForm(), title: 'Alt+T' }, '+ Task'),
      h('button', { class: 'btn icon', 'aria-label': `Switch to ${theme} theme`, title: `Switch to ${theme} theme`, onclick: async () => { try { await L.put('/settings', { theme }); await L.loadRefs(); L.buildChrome(); L.refresh(); } catch (e) { L.fail(e); } } }, L.settings.theme === 'light' ? '☾' : '☀'));
    const mq = window.matchMedia('(max-width:900px)'); const mb = L.$('#menu-btn'); const upd = () => { mb.style.display = mq.matches ? '' : 'none'; }; upd(); mq.addEventListener('change', upd);
    L.markNav(L.parseHash().path);
    if (L.afterChrome) L.afterChrome();
  };

  // ---- date change detection (never relies only on timers) ----
  async function checkDate(force) {
    const now = L.today();
    if (now !== currentDate || force) {
      const changed = now !== currentDate; currentDate = now;
      try { const r = await L.post('/system/tick'); const lbl = L.$('#today-label'); if (lbl) lbl.textContent = L.fmtDate(now, true);
        if (changed) { L.toast(r.new_month ? `A new month has started: ${L.fmtMonth(now.slice(0, 7))}` : 'A new day has started', 'ok'); L.refresh(); } } catch (e) { console.warn('tick failed', e); }
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDate(); });
  window.addEventListener('focus', () => checkDate());
  setInterval(() => checkDate(), 60000);

  document.addEventListener('keydown', e => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return; const k = e.key.toLowerCase();
    if (k === 'e') { e.preventDefault(); L.openExpense(); } else if (k === 'i') { e.preventDefault(); L.openIncome(); } else if (k === 't') { e.preventDefault(); L.taskForm(); } else if (k === 'v') { e.preventDefault(); L.openInvest(); }
  });
  window.addEventListener('unhandledrejection', e => { console.error(e.reason); });

  // ---- tell the server this tab is open; it closes itself (and the database) after the last tab closes ----
  const tabId = (() => { let id = sessionStorage.getItem('lifeos_tab'); if (!id) { id = (L.uuid() || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32); sessionStorage.setItem('lifeos_tab', id); } return id; })();
  const beat = () => window.LIFEOS_MOBILE ? undefined : fetch('/api/system/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tabId }), keepalive: true }).catch(() => {});
  beat(); setInterval(beat, 10000); document.addEventListener('visibilitychange', () => { if (!document.hidden) beat(); });
  window.addEventListener('pagehide', () => { if (window.LIFEOS_MOBILE) return; try { navigator.sendBeacon('/api/system/bye', new Blob([JSON.stringify({ id: tabId })], { type: 'application/json' })); } catch (_) {} });

  async function boot() {
    L.mount(L.$('#view'), L.loading());
    try {
      await L.loadRefs();
      L.buildChrome();
      const t = L.post('/system/tick').then(r => { if (r && r.new_day && r.previous_open) { /* data may have been generated for new dates */ } return r; }).catch(() => null);
      if (L.settings.onboarded !== '1' && L.parseHash().path !== '/onboarding') { location.hash = '#/onboarding'; }
      else await L.refresh();
      t.then(r => { if (r && r.created && (r.created.task_occurrences || r.created.expected_income) && L.parseHash().path !== '/onboarding') L.refresh(); });
    } catch (e) {
      console.error(e);
      L.mount(L.$('#view'), h('div', { class: 'card' }, h('h2', {}, 'LifeOS could not start'), h('p', {}, e.message), h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Reload')));
    }
  }
  boot();
})();
