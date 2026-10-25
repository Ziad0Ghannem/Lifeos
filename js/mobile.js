'use strict';
/* LifeOS mobile layer: bottom navigation, quick-add button, phone-friendly dialogs, file downloads, data-safety helpers, install support. */
(function () {
  const { h } = L;
  const get = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { } };
  const DAY = 86400000;

  // ---------- saving files to the phone ----------
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob); const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  L.saveBlob = saveBlob;
  L.download = async (url) => {
    try {
      const res = await fetch(url); if (!res.ok) { let m = 'Download failed'; try { m = (await res.json()).error || m; } catch (_) { } throw new Error(m); }
      const blob = await res.blob(); const m = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') || ''); const name = m ? m[1] : 'lifeos-file';
      saveBlob(blob, name); if (/^lifeos-.*\.(db|json)$/.test(name)) put('lifeos_last_file_backup', new Date().toISOString());
      L.toast(L.t('Saved to your Downloads') + ': ' + name);
    } catch (e) { L.fail(e); }
  };

  // ---------- phone Back button closes dialogs instead of leaving the app ----------
  const stack = []; let ignore = 0; const origModal = L.modal;
  window.addEventListener('popstate', () => { if (ignore > 0) { ignore--; return; } const top = stack.pop(); if (top) { top.viaPop = true; top.api.close(); } });
  L.modal = function (opts) {
    const entry = {}; const userClose = opts && opts.onClose;
    const api = origModal.call(this, Object.assign({}, opts, { onClose: () => {
      const i = stack.indexOf(entry);
      if (i >= 0) { stack.splice(i, 1); if (history.state && history.state.lifeosModal) { ignore++; history.back(); } }
      if (userClose) userClose();
    } }));
    entry.api = api; stack.push(entry); try { history.pushState({ lifeosModal: 1 }, ''); } catch (_) { }
    return api;
  };

  // ---------- navigation chrome ----------
  const TABS = [['/dashboard', '◉', 'Home'], ['/daily', '☰', 'Daily'], ['/tasks', '☑', 'Tasks'], ['/finance', '◈', 'Finance']];
  const onTab = (path, p) => p === '/finance' ? path.startsWith('/finance') : path === p || path.startsWith(p + '/');
  function markTabs() {
    const nav = document.getElementById('bottomnav'); if (!nav) return; const path = L.parseHash().path; let any = false;
    nav.querySelectorAll('a[data-p]').forEach(a => { const on = onTab(path, a.dataset.p); a.classList.toggle('on', on); if (on) { any = true; a.setAttribute('aria-current', 'page'); } else a.removeAttribute('aria-current'); });
    const more = document.getElementById('more-btn'); if (more) more.classList.toggle('on', !any);
  }
  function quickAdd() {
    let m; const go = fn => () => { m.close(); setTimeout(fn, 50); };
    const btn = (icon, label, fn, cls) => h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick: go(fn) }, h('b', {}, icon), label);
    m = L.modal({ title: 'Quick add', body: h('div', { class: 'sheet-grid' }, btn('−', 'Add expense', () => L.openExpense(), 'primary'), btn('+', 'Add income', () => L.openIncome()), btn('↗', 'Invest', () => L.openInvest()), btn('⇄', 'Transfer', () => L.openTransfer()), btn('☑', 'Add task', () => L.taskForm())), actions: [{ label: 'Close' }] });
  }
  let wired = false;
  L.afterChrome = () => {
    const sb = L.$('#sidebar'); const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = L.settings.theme === 'light' ? '#F4F6F9' : '#10151D';
    ['bottomnav', 'fab'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); });
    const nav = h('nav', { id: 'bottomnav', class: 'bottomnav', 'aria-label': 'Main navigation' },
      TABS.map(([p, ico, label]) => h('a', { href: '#' + p, dataset: { p } }, h('span', { class: 'ico' }, ico), L.t(label))),
      h('button', { id: 'more-btn', type: 'button', onclick: () => sb.classList.toggle('mobile-open') }, h('span', { class: 'ico' }, '☰'), L.t('More')));
    const fab = h('button', { id: 'fab', class: 'fab', type: 'button', 'aria-label': 'Quick add', onclick: quickAdd }, '+');
    document.body.append(nav, fab);
    if (!wired) {
      wired = true;
      window.addEventListener('hashchange', markTabs);
      new MutationObserver(() => document.body.classList.toggle('drawer-open', sb.classList.contains('mobile-open'))).observe(sb, { attributes: true, attributeFilter: ['class'] });
      document.addEventListener('click', e => { if (document.body.classList.contains('drawer-open') && !sb.contains(e.target) && !e.target.closest('#menu-btn,#more-btn')) sb.classList.remove('mobile-open'); }, true);
    }
    markTabs();
  };

  // ---------- data safety (the data lives only on this phone) ----------
  const daysSince = iso => iso ? (Date.now() - new Date(iso).getTime()) / DAY : Infinity;
  const hasData = c => (c.transactions + c.goals + c.tasks + c.habits) > 0;
  async function downloadFreshBackup() {
    const r = await L.post('/backups'); await L.download('/api/backups/' + r.name + '/file'); return r;
  }
  const b64 = buf => { let s = ''; const b = new Uint8Array(buf); const n = 0x8000; for (let i = 0; i < b.length; i += n) s += String.fromCharCode.apply(null, b.subarray(i, i + n)); return btoa(s); };
  L.restoreFromFile = () => {
    const file = h('input', { type: 'file', accept: '.db,application/octet-stream,application/x-sqlite3' });
    L.modal({ title: 'Restore from a backup file', body: h('div', { class: 'stack' }, h('p', { class: 'small muted', style: 'margin:0' }, 'Choose a LifeOS backup file (.db) that you saved earlier. It is checked first; your current data is saved as a safety backup before anything is replaced.'), L.field('Backup file', file)),
      actions: [{ label: 'Cancel' }, { label: 'Restore', class: 'danger', onClick: async () => {
        if (!file.files[0]) throw new Error('Choose a backup file first.');
        const up = await L.post('/backups/upload', { data_base64: b64(await file.files[0].arrayBuffer()) });
        const r = await L.post(`/backups/${up.name}/restore`, { confirm: true }); await L.loadRefs(); L.toast(L.t('Restored. Your previous data is saved as') + ' ' + r.safety_backup); L.buildChrome(); L.refresh();
      } }] });
  };
  async function safeCard() {
    const health = await L.get('/system/health'); const st = health.storage || {}; const last = get('lifeos_last_file_backup'); const days = daysSince(last);
    const ok = st.persisted === true && days < 14;
    const mb = n => n ? (n / 1048576).toFixed(1) + ' MB' : '—';
    return h('div', { class: 'card safe-card' + (ok ? ' ok' : ''), style: 'margin-bottom:14px' }, h('h2', {}, 'Keep my data safe'),
      h('p', { class: 'small muted', style: 'margin-top:0' }, 'Your data lives only on this phone, inside this app. If you clear the browser data or remove the app it can be lost. Download a backup file now and then and keep it in Files, Google Drive or email.'),
      h('div', { class: 'row', style: 'margin-bottom:10px' }, L.badge(st.persisted === true ? 'Protected from automatic clean-up' : 'Not protected yet', st.persisted === true ? 'ok' : 'warn'), L.badge(last ? `${L.t('Last file backup')}: ${L.dt(last)}` : 'No backup file saved yet', days < 14 ? 'ok' : 'warn'), h('span', { class: 'small muted' }, `${L.t('Used')}: ${mb(st.usage)}`)),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async e => { e.currentTarget.disabled = true; try { await downloadFreshBackup(); L.refresh(); } catch (er) { L.fail(er); e.currentTarget.disabled = false; } } }, 'Download a backup file now'),
        st.persisted === true || !(navigator.storage && navigator.storage.persist) ? null : h('button', { class: 'btn', onclick: async () => { try { const g = await navigator.storage.persist(); L.toast(g ? 'Your data is now protected' : 'The browser did not allow it. Install LifeOS to the home screen, then try again.', g ? 'ok' : 'warn'); L.refresh(); } catch (er) { L.fail(er); } } }, 'Protect my data'),
        h('button', { class: 'btn', onclick: () => L.restoreFromFile() }, 'Restore from a file…')));
  }
  const wrap = (path, fn) => { const orig = L.routes[path]; if (!orig) return; L.routes[path] = async (...a) => { const el = await orig(...a); try { await fn(el, ...a); } catch (e) { console.warn('[mobile]', path, e); } return el; }; };
  wrap('/data', async (root) => { const head = root.querySelector('.page-head'); const c = await safeCard(); if (head) head.after(c); else root.prepend(c); });
  wrap('/dashboard', async (root) => {
    if (get('lifeos_nag') && Date.now() - Number(get('lifeos_nag')) < 3 * DAY) return;
    const health = await L.get('/system/health'); const last = get('lifeos_last_file_backup'); if (!hasData(health.counts) || daysSince(last) < 14) return;
    const card = h('div', { class: 'card safe-card', style: 'margin-bottom:14px' }, h('b', {}, 'Save a backup file'), h('p', { class: 'small muted', style: 'margin:4px 0 10px' }, last ? 'Your last backup file is more than two weeks old.' : 'You have not saved a backup file yet. Your data lives only on this phone.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary sm', onclick: async e => { e.currentTarget.disabled = true; try { await downloadFreshBackup(); card.remove(); } catch (er) { L.fail(er); e.currentTarget.disabled = false; } } }, 'Download a backup file now'), h('button', { class: 'btn ghost sm', onclick: () => { put('lifeos_nag', String(Date.now())); card.remove(); } }, 'Later')));
    const head = root.querySelector('.page-head'); if (head) head.after(card); else root.prepend(card);
  });

  // ---------- install + settings ----------
  let deferred = null; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  wrap('/settings', async (root) => {
    const old = root.querySelector('#app-card'); if (old) old.remove();
    root.append(h('div', { class: 'card', style: 'margin-top:14px' }, h('h2', {}, 'Install on your phone'),
      standalone() ? h('p', { class: 'small', style: 'margin:0' }, 'LifeOS is installed and works without internet.') : h('div', { class: 'stack' },
        h('p', { class: 'small muted', style: 'margin:0' }, 'Add LifeOS to your home screen so it opens like a normal app and works offline. Android (Chrome): menu ⋮ → Install app. iPhone (Safari): Share → Add to Home Screen.'),
        deferred ? h('button', { class: 'btn primary', onclick: async () => { deferred.prompt(); try { await deferred.userChoice; } catch (_) { } deferred = null; L.refresh(); } }, 'Install app') : null),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: () => { localStorage.removeItem('lifeos_sidebar'); L.toast('Layout preferences reset'); } }, 'Reset layout'))));
  });

  // ---------- offline support ----------
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker', e)); });
  // ask the browser to keep our storage when it is cleaning up (silently granted for installed apps)
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) { }
  // tapping elsewhere dismisses an open "!" tip
  document.addEventListener('touchstart', e => { const a = document.activeElement; if (a && a.classList && a.classList.contains('help') && !e.target.closest('.help')) a.blur(); }, { passive: true });
  // storage problems must never be silent
  window.addEventListener('load', () => { setTimeout(() => { const E = window.LifeOSEngine; if (E && E.vfs && E.vfs.__persistent && !E.vfs.__persistent()) L.toast('This browser is not allowing LifeOS to store data (private mode?). Your entries will be lost when you close the app.', 'error'); }, 2500); });
})();
