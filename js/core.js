'use strict';
/* LifeOS frontend core. No framework: tiny DOM builder, hash router, modal, toast, API client, chart helper.
   User text is always inserted as text nodes (never innerHTML), so stored data cannot inject markup. */
(function () {
  const L = window.L = { routes: {}, charts: [], settings: {}, fcats: [], accounts: [], refs: {} };

  // ---------- DOM ----------
  L.h = function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (typeof v === 'string' && (k === 'placeholder' || k === 'title' || k === 'aria-label' || k === 'label' || k === 'alt')) el.setAttribute(k, L.t(v));
      else if (k === 'class') el.className = v;
      else if (k === 'style') { if (typeof v === 'string') el.style.cssText = v; else Object.assign(el.style, v); }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'required' || k === 'multiple' || k === 'open') { if (v) el[k] = true; }
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (k) => { if (k === null || k === undefined || k === false) return; if (Array.isArray(k)) return k.forEach(add); el.append(k instanceof Node ? k : document.createTextNode(typeof k === 'string' ? L.t(k) : String(k))); };
    kids.forEach(add); return el;
  };
  const h = L.h;
  L.$ = (s, r = document) => r.querySelector(s); L.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  L.clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  L.mount = (el, ...kids) => { L.clear(el); kids.flat().forEach(k => k && el.append(k)); return el; };

  // ---------- i18n (English default; full Arabic UI) ----------
  const I18 = window.I18N_AR || { dict: {}, patterns: [], help: {} };
  const ALLP = I18.patterns.map(([r, t]) => [new RegExp(r), t]); const DOTP = ALLP.filter(([re]) => re.source.includes('·')); const PATS = ALLP.filter(([re]) => !re.source.includes('·')); const cache = new Map();
  L.isAr = () => L.settings.language === 'ar';
  const fill = (tpl, m) => tpl.replace(/\$(\d)/g, (_, i) => L.t(m[i] || ''));
  function tr(c) {
    if (Object.prototype.hasOwnProperty.call(I18.dict, c)) return I18.dict[c];
    for (const [re, tpl] of DOTP) { const m = re.exec(c); if (m) return fill(tpl, m); }
    if (c.includes(' · ')) return c.split(' · ').map(x => L.t(x)).join(' · ');
    for (const [re, tpl] of PATS) { const m = re.exec(c); if (m) return fill(tpl, m); }
    const kv = /^([^:]{2,60}): (.+)$/.exec(c); // "Label: value"
    if (kv) { const lt = L.t(kv[1]); if (lt !== kv[1]) return lt + ': ' + L.t(kv[2]); }
    if (c.includes(', ') && c.length < 160) { const parts = c.split(', '); const out = parts.map(x => L.t(x)); if (out.some((x, i) => x !== parts[i])) return out.join('، '); }
    return c;
  }
  /** Translate a UI string (exact phrase or pattern). Leading/trailing spaces are kept. Unknown text is returned unchanged. */
  L.t = s => {
    if (!L.isAr() || typeof s !== 'string' || !s) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s); let core = m[2]; if (!core || !/[A-Za-z]/.test(core)) return s;
    const iso = /[\u2066\u2069]/.test(core); if (iso) core = core.replace(/[\u2066\u2069]/g, ''); // matched without bidi isolates, re-applied to numbers afterwards
    let r = cache.get(core); if (r === undefined) { r = tr(core); if (/\d\s?EGP\b/.test(r)) r = r.replace(/(\d)\s?EGP\b/g, '$1 ج.م'); cache.set(core, r); } if (iso) r = r.replace(/[+\-]?\d+(?:[.,]\d+)*%?/g, x => '\u2066' + x + '\u2069'); return m[1] + r + m[3];
  };
  L.helpFor = label => { const e = I18.help[label]; return e ? e[L.isAr() ? 1 : 0] : null; };
  L.untranslated = new Set();

  // ---------- dates & money ----------
  const pad = n => String(n).padStart(2, '0');
  L.today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const toUTC = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const fromUTC = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  L.addDays = (s, n) => fromUTC(toUTC(s) + n * 86400000); L.diffDays = (a, b) => Math.round((toUTC(a) - toUTC(b)) / 86400000);
  L.addMonths = (k, n) => { let [y, m] = k.split('-').map(Number); const t = y * 12 + m - 1 + n; return `${Math.floor(t / 12)}-${pad(t % 12 + 1)}`; };
  L.monthEnd = k => { const [y, m] = k.split('-').map(Number); return `${k}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`; };
  L.dow = s => new Date(toUTC(s)).getUTCDay();
  const EN_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const AR_MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'], AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], AR_DAYS_S = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  L.MON = EN_MON; L.DAYS = EN_DAYS; L.DAYS_SHORT = EN_DAYS.map(d => d.slice(0, 3));
  L.applyLang = () => { const ar = L.isAr(); L.MON = ar ? AR_MON : EN_MON; L.DAYS = ar ? AR_DAYS : EN_DAYS; L.DAYS_SHORT = ar ? AR_DAYS_S : EN_DAYS.map(d => d.slice(0, 3)); };
  L.fmtDate = (s, long) => { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return long ? `${L.DAYS[L.dow(s)]}${L.isAr() ? '،' : ','} ${d} ${L.MON[m - 1]} ${y}` : `${d} ${L.MON[m - 1]} ${y}`; };
  L.fmtMonth = k => { const [y, m] = k.split('-').map(Number); return `${L.MON[m - 1]} ${y}`; };
  L.fmtTime = t => { if (!t) return ''; if (L.settings.time_format !== '12h') return t; const [hh, mm] = t.split(':').map(Number); return `${hh % 12 || 12}:${pad(mm)} ${hh < 12 ? (L.isAr() ? 'ص' : 'AM') : (L.isAr() ? 'م' : 'PM')}`; };
  L.dt = iso => new Date(iso).toLocaleString(L.isAr() ? 'ar-EG-u-nu-latn' : undefined);
  L.dtDate = iso => new Date(iso).toLocaleDateString(L.isAr() ? 'ar-EG-u-nu-latn' : undefined);
  const group = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  L.cur = () => L.settings.currency || 'EGP';
  L.curSym = () => (L.isAr() && L.cur() === 'EGP') ? 'ج.م' : L.cur();
  L.ltr = s => L.isAr() ? '\u2066' + s + '\u2069' : s; // keep signs, digits and % in reading order inside right-to-left text
  L.num = (minor, always2) => { if (minor === null || minor === undefined) return '—'; const neg = minor < 0, a = Math.abs(minor); const w = Math.floor(a / 100), f = a % 100; return L.ltr(`${neg ? '-' : ''}${group(w)}${(f || always2) ? '.' + pad(f) : ''}`); };
  L.money = (minor, always2) => minor === null || minor === undefined ? '—' : `${L.num(minor, always2)} ${L.curSym()}`;
  L.money2 = m => L.money(m, true);
  L.signed = m => m === null || m === undefined ? '—' : (m > 0 ? '+' : '') + L.money(m);
  L.pct = v => v === null || v === undefined ? '—' : L.ltr(`${Math.round(v * 10) / 10}%`);
  L.minorToInput = m => m === null || m === undefined ? '' : (m / 100).toFixed(2).replace(/\.00$/, '');
  L.uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12));

  // ---------- API ----------
  class ApiError extends Error { constructor(m, status, code, data) { super(m); this.status = status; this.code = code; this.data = data; } }
  L.ApiError = ApiError;
  L.api = async (method, path, body) => {
    let res;
    try { res = await fetch('/api' + path, { method, headers: body !== undefined ? { 'Content-Type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined }); }
    catch (e) { throw new ApiError(L.t('LifeOS could not start on this device. Close and reopen it. If this keeps happening, allow site data and storage for this app in your browser settings.'), 0, 'NETWORK'); }
    let data = null; const text = await res.text(); try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) throw new ApiError(L.t((data && data.error) || `Request failed (${res.status})`), res.status, data && data.code, data);
    return data;
  };
  L.get = p => L.api('GET', p); L.post = (p, b) => L.api('POST', p, b || {}); L.put = (p, b) => L.api('PUT', p, b || {}); L.del = p => L.api('DELETE', p);
  L.qs = o => { const p = new URLSearchParams(); Object.entries(o || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); }); const s = p.toString(); return s ? '?' + s : ''; };
  L.download = url => { const a = h('a', { href: url, download: '' }); document.body.append(a); a.click(); a.remove(); };

  // ---------- toast / modal ----------
  L.toast = (msg, type = 'ok', ms = 3200) => { const t = h('div', { class: 'toast ' + (type === 'ok' ? '' : type), role: type === 'error' ? 'alert' : 'status' }, msg); L.$('#toasts').append(t); setTimeout(() => t.remove(), type === 'error' ? 6000 : ms); };
  L.fail = e => { console.error(e); L.toast(e && e.message ? e.message : String(e), 'error'); };
  L.modal = function ({ title, body, actions = [], wide = false, onClose }) {
    const root = L.$('#modal-root'); const prev = document.activeElement;
    const errBox = h('div', { class: 'form-err', style: 'display:none', role: 'alert' });
    const close = () => { ov.remove(); document.removeEventListener('keydown', key, true); if (prev && prev.focus) try { prev.focus(); } catch (_) {} onClose && onClose(); };
    const key = e => { if (e.key === 'Escape' && root.lastElementChild === ov) { e.stopPropagation(); close(); } };
    const api = { close, el: null, error(msg) { errBox.textContent = L.t(msg || ''); errBox.style.display = msg ? '' : 'none'; if (msg) errBox.scrollIntoView({ block: 'nearest' }); } };
    const foot = h('div', { class: 'modal-f' }, actions.map(a => { const b = h('button', { class: 'btn ' + (a.class || ''), type: 'button', disabled: false }, a.label); b.addEventListener('click', async () => {
      if (b.disabled) return; b.disabled = true; api.error('');
      try { const r = a.onClick ? await a.onClick(api) : true; if (r !== false && a.close !== false) close(); } catch (e) { api.error(L.t(e.message || String(e))); if (e.data && e.data.field) { } } finally { b.disabled = false; } }); a.el = b; return b; }));
    const ov = h('div', { class: 'overlay', onmousedown: e => { if (e.target === ov) ov._down = true; }, onclick: e => { if (e.target === ov && ov._down) close(); } },
      h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('div', { class: 'modal-h' }, h('h2', {}, title), h('button', { class: 'btn ghost icon', 'aria-label': 'Close', onclick: close }, '✕')), h('div', { class: 'modal-b' }, errBox, body), actions.length ? foot : null));
    root.append(ov); document.addEventListener('keydown', key, true); api.el = ov;
    setTimeout(() => { const f = L.$('[autofocus],input:not([type=hidden]):not([type=checkbox]),select,textarea', ov.querySelector('.modal-b')); f && f.focus(); }, 30);
    return api;
  };
  L.confirm = (message, { okLabel = 'Confirm', danger = false, title = 'Please confirm' } = {}) => new Promise(res => {
    let done = false; const m = L.modal({ title, body: h('p', { style: 'margin:0' }, message), onClose: () => { if (!done) res(false); }, actions: [{ label: 'Cancel', onClick: () => { done = true; res(false); } }, { label: okLabel, class: danger ? 'danger' : 'primary', onClick: () => { done = true; res(true); } }] });
  });
  L.confirmDelete = (what) => L.settings.confirm_delete === '0' ? Promise.resolve(true) : L.confirm(`Delete ${what}? This cannot be undone.`, { okLabel: 'Delete', danger: true, title: 'Delete' });

  // ---------- form helpers ----------
  L.helpIcon = (text) => { const t = L.t(text); return h('span', { class: 'help', tabindex: '0', role: 'img', 'aria-label': t, 'data-tip': t, onclick: e => { e.preventDefault(); e.stopPropagation(); } }, '!'); };
  L.field = (label, input, { req, hint, cls, help } = {}) => {
    const ht = help || L.helpFor(label); if (!ht && label && typeof label === 'string') L.untranslated.add('HELP:' + label);
    return h('label', { class: 'f ' + (cls || '') }, h('span', { class: 'lblrow' }, h('span', { class: req ? 'req' : '' }, label), ht ? L.helpIcon(ht) : null), input, hint ? h('span', { class: 'small' }, hint) : null);
  };
  L.select = (opts, value, props = {}) => {
    const s = h('select', props); let grp = null, g = null;
    opts.forEach(o => { if (typeof o === 'string') o = { value: o, label: o }; const op = h('option', { value: o.value ?? '' }, o.label); if (String(o.value ?? '') === String(value ?? '')) op.selected = true;
      if (o.group) { if (o.group !== grp) { grp = o.group; g = h('optgroup', { label: grp }); s.append(g); } g.append(op); } else { grp = null; s.append(op); } });
    return s;
  };
  L.catOptions = (kind, { withBlank = true, blankLabel = 'Select a category', includeArchivedId } = {}) => {
    const list = L.fcats.filter(c => c.kind === kind && (!c.archived || c.id === includeArchivedId));
    const o = withBlank ? [{ value: '', label: blankLabel }] : []; list.forEach(c => o.push({ value: c.id, label: c.name + (c.archived ? ' (archived)' : ''), group: c.group_name || undefined })); return o;
  };
  L.accountOptions = (blank = 'No account') => [{ value: '', label: blank }, ...L.accounts.filter(a => a.status === 'active').map(a => ({ value: a.id, label: a.name }))];
  L.badge = (text, cls = '') => h('span', { class: 'chip ' + cls }, text);
  L.progress = (pct, { cls = '', mark } = {}) => h('div', { class: 'bar ' + cls, role: 'progressbar', 'aria-valuenow': Math.round(pct || 0), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: `width:${Math.min(100, Math.max(0, pct || 0))}%` }), mark !== undefined && mark !== null ? h('span', { class: 'mark', style: `inset-inline-start:${Math.min(100, Math.max(0, mark))}%` }) : null);
  L.empty = (title, text, action) => h('div', { class: 'empty' }, h('b', {}, title), text ? h('div', {}, text) : null, action ? h('div', { style: 'margin-top:12px' }, action) : null);
  L.loading = () => h('div', { class: 'loading' }, 'Loading…');
  L.kpiCard = (label, value, { hint, cls, onClick, href } = {}) => {
    const go = () => { if (href) location.hash = href; else if (onClick) onClick(); };
    return h('div', { class: 'card kpi', tabindex: 0, role: 'link', 'aria-label': `${label}: ${value}`, onclick: go, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } },
      h('div', { class: 'lbl' }, label), h('div', { class: 'val num ' + (cls || '') }, value), hint ? h('div', { class: 'hint' }, hint) : null);
  };

  // ---------- table ----------
  L.table = ({ columns, rows, empty = 'Nothing here yet', sort, onSort, rowKey }) => {
    const head = h('tr', {}, columns.map(c => h('th', { class: (c.money ? 'money ' : '') + (c.sort ? 'sortable' : ''), 'aria-sort': sort && sort.key === c.sort ? (sort.dir === 'asc' ? 'ascending' : 'descending') : null, onclick: c.sort && onSort ? () => onSort(c.sort) : null }, c.label, sort && sort.key === c.sort ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')));
    const body = rows.map(r => h('tr', { dataset: rowKey ? { key: rowKey(r) } : {} }, columns.map(c => { const v = c.render ? c.render(r) : r[c.key]; return h('td', { class: c.money ? 'money num' : (c.cls || ''), 'data-label': typeof c.label === 'string' ? L.t(c.label) : '' }, v === null || v === undefined ? '' : v); })));
    if (!rows.length) return L.empty(empty);
    return h('div', { class: 'tbl-wrap' }, h('table', {}, h('thead', {}, head), h('tbody', {}, body)));
  };

  // ---------- charts ----------
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  L.chart = (host, type, data, extra = {}) => {
    data = { ...data, labels: (data.labels || []).map(x => typeof x === 'string' ? L.t(x) : x), datasets: data.datasets.map(d => ({ ...d, label: L.t(d.label) })) };
    const canvas = h('canvas', { role: 'img', 'aria-label': extra.label || 'Chart' }); L.mount(host, canvas);
    if (!window.Chart) { host.textContent = 'Charts are unavailable'; return null; }
    const muted = css('--muted'), line = css('--line'); const circ = type === 'doughnut' || type === 'pie';
    const opts = { responsive: true, maintainAspectRatio: false, animation: { duration: 250 }, plugins: { legend: { rtl: L.isAr(), display: extra.legend ?? (circ || data.datasets.length > 1), position: circ ? 'right' : 'bottom', labels: { color: muted, boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: extra.tooltip || {} } },
      scales: circ ? {} : { x: { ticks: { color: muted, maxRotation: 0, autoSkip: true }, grid: { display: false } }, y: { beginAtZero: extra.beginAtZero !== false, ticks: { color: muted, callback: extra.yTick }, grid: { color: line }, suggestedMax: extra.max } } };
    const c = new Chart(canvas, { type, data, options: Object.assign(opts, extra.options || {}) }); L.charts.push(c); return c;
  };
  L.moneyTick = v => { const n = v / 100; return Math.abs(n) >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(n); };
  L.moneyTip = { label: ctx => `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${L.money(ctx.parsed.y ?? ctx.parsed)}` };
  L.destroyCharts = () => { L.charts.forEach(c => { try { c.destroy(); } catch (_) {} }); L.charts = []; };
  L.colors = { accent: '#E65100', ok: '#2EAD74', warn: '#E9AD45', bad: '#E45D5D', info: '#4C8DFF', muted: '#9AA6B5' };

  // ---------- router ----------
  L.parseHash = () => { const raw = location.hash.replace(/^#/, '') || '/dashboard'; const [path, q] = raw.split('?'); return { path, query: Object.fromEntries(new URLSearchParams(q || '')) }; };
  L.go = (path, query) => { const next = '#' + path + L.qs(query); if (location.hash === next) L.refresh(); else location.hash = next; };
  let renderToken = 0;
  L.refresh = async () => {
    const { path, query } = L.parseHash(); const view = L.$('#view'); const fn = L.routes[path] || L.routes['/dashboard']; const token = ++renderToken;
    L.destroyCharts(); L.markNav(path);
    const y = view.scrollTop;
    try { const node = await fn(query, view); if (token !== renderToken) return; if (node) L.mount(view, node); view.scrollTop = y; }
    catch (e) { if (token !== renderToken) return; console.error(e); L.mount(view, h('div', { class: 'card' }, h('h2', {}, 'This page could not load'), h('p', { class: 'form-err' }, e.message), h('button', { class: 'btn', onclick: L.refresh }, 'Try again'))); }
  };
  window.addEventListener('hashchange', () => { const v = L.$('#view'); v.scrollTop = 0; L.mount(v, L.loading()); L.refresh(); });

  // ---------- refs ----------
  L.loadRefs = async () => {
    const [settings, fcats, accounts] = await Promise.all([L.get('/settings'), L.get('/fin/categories'), L.get('/fin/accounts')]);
    L.settings = settings; L.fcats = fcats; L.accounts = accounts;
    L.applyLang(); document.documentElement.dataset.theme = settings.theme; document.documentElement.lang = settings.language; document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
  };
  L.catName = id => L.t((L.fcats.find(c => c.id === id) || {}).name || '—');
  L.catColor = id => (L.fcats.find(c => c.id === id) || {}).color || '#9AA6B5';
  L.thresholds = () => (L.settings.budget_thresholds || '50,75,90,100').split(',').map(Number);
  L.level = (consumed) => consumed === null || consumed === undefined ? '' : consumed > 100 ? 'bad' : consumed >= 90 ? 'bad' : consumed >= 75 ? 'warn' : consumed >= 50 ? 'warn' : 'ok';

  // ---------- period bar (finance) ----------
  L.periodState = () => { try { return JSON.parse(sessionStorage.getItem('fin_period')) || { period: 'month', offset: 0 }; } catch { return { period: 'month', offset: 0 }; } };
  L.periodBar = (state, onChange, { label } = {}) => {
    const save = () => { sessionStorage.setItem('fin_period', JSON.stringify(state)); onChange(state); };
    const names = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['month', 'This month'], ['prev_month', 'Previous month'], ['quarter', 'This quarter'], ['year', 'This year'], ['custom', 'Custom']];
    const sel = L.select(names.map(([v, l]) => ({ value: v, label: l })), state.period, { 'aria-label': 'Period', style: 'width:auto', onchange: e => { state.period = e.target.value; state.offset = 0; save(); } });
    const nav = state.period !== 'custom' ? [h('button', { class: 'btn icon', 'aria-label': 'Previous period', onclick: () => { state.offset--; save(); } }, '‹'), h('button', { class: 'btn icon', 'aria-label': 'Next period', onclick: () => { state.offset++; save(); } }, '›'), state.offset !== 0 ? h('button', { class: 'btn sm ghost', onclick: () => { state.offset = 0; save(); } }, 'Current') : null]
      : [h('input', { type: 'date', value: state.from || '', style: 'width:auto', 'aria-label': 'From', onchange: e => { state.from = e.target.value; if (state.from && state.to) save(); } }), h('span', { class: 'muted' }, 'to'), h('input', { type: 'date', value: state.to || '', style: 'width:auto', 'aria-label': 'To', onchange: e => { state.to = e.target.value; if (state.from && state.to) save(); } })];
    return h('div', { class: 'row pill-nav no-print' }, sel, ...nav, label ? h('span', { class: 'muted' }, label) : null);
  };
  L.finLink = (path, state, extra) => ({ path, query: { ...(state.period === 'custom' ? { from: state.from, to: state.to } : {}), ...extra } });

  // ---------- misc ----------
  L.riskChip = r => { const m = { on_track: ['On track', 'ok'], at_risk: ['At risk', 'warn'], behind: ['Behind', 'bad'], overdue: ['Overdue', 'bad'], completed: ['Completed', 'ok'], paused: ['Paused', ''], no_deadline: ['No deadline', ''], abandoned: ['Abandoned', ''], archived: ['Archived', ''] }[r] || [r, '']; return L.badge(m[0], m[1]); };
  L.debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  L.lines = s => (s || '').split('\n').filter(x => x.trim());
  L.statusDot = c => h('span', { class: 'dot', style: `background:${c}` });
})();
