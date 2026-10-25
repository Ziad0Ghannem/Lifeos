'use strict';
(function () {
  const { h } = L;
  const sev = s => s === 'bad' ? 'bad' : s === 'warn' ? 'warn' : '';

  // ================= Finance overview =================
  L.routes['/finance'] = async (q) => {
    const st = L.periodState(); if (q.period) { st.period = q.period; st.offset = Number(q.offset || 0); }
    if (q.from && q.to) { st.period = 'custom'; st.from = q.from; st.to = q.to; }
    const o = await L.get('/fin/overview' + L.qs(st)); const t = o.totals; const per = o.period;
    const link = (path, extra) => { const x = L.finLink(path, st, extra); return `#${x.path}${L.qs({ ...x.query, from: per.from, to: per.to, ...(extra || {}) })}`; };
    const root = h('div', {});
    const bar = L.periodBar(st, () => L.refresh(), { label: `${L.fmtDate(per.from)} – ${L.fmtDate(per.to)}` });
    root.append(h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, L.t('Finance Overview')), h('p', { class: 'sub-t', style: 'margin:0' }, 'Cash flow, spending, savings and obligations from your recorded transactions.')),
      h('div', { class: 'row no-print' }, h('button', { class: 'btn', onclick: () => L.openTransfer() }, 'Transfer'))));
    root.append(h('div', { style: 'margin-bottom:14px' }, bar));
    const rem = o.budget.remaining_minor;
    const upc = o.upcoming;
    root.append(h('div', { class: 'cards', style: 'margin-bottom:16px' },
      L.kpiCard(L.t('Total income'), L.money(t.income_minor), { hint: `${t.income_count} received`, href: `/finance/income${L.qs({ from: per.from, to: per.to })}` }),
      L.kpiCard(L.t('Total expenses'), L.money(t.expense_minor), { hint: t.refund_minor ? `after ${L.money(t.refund_minor)} refunds` : 'net of refunds', href: `/finance/expenses${L.qs({ from: per.from, to: per.to })}` }),
      L.kpiCard(L.t('Net cash flow'), L.signed(t.net_cash_flow_minor), { cls: t.net_cash_flow_minor < 0 ? 'neg' : t.net_cash_flow_minor > 0 ? 'pos' : '', hint: 'income − expenses', href: `/finance/reports${L.qs({ report: 'cashflow_trend' })}` }),
      L.kpiCard('Actual savings', L.money(o.contributions_minor), { hint: 'contributed to savings goals', href: '/finance/savings' }),
      L.kpiCard(L.t('Savings rate'), t.savings_rate === null ? '—' : L.pct(t.savings_rate), { cls: t.savings_rate !== null && t.savings_rate < 0 ? 'neg' : '', hint: t.savings_rate === null ? 'needs confirmed income' : 'net cash flow ÷ income', href: `/finance/reports${L.qs({ report: 'savings_rate_trend' })}` }),
      L.kpiCard('Total budget', o.budget.total_minor === null ? 'Not set' : L.money(o.budget.total_minor), { hint: o.budget.partial_period ? 'month budget(s) touched by range' : (o.budget.total_minor === null ? 'set one in Budgets' : ''), href: `/finance/budgets${L.qs({ month: per.month })}` }),
      L.kpiCard(L.t('Remaining budget'), rem === null ? '—' : L.money(rem), { cls: rem !== null && rem < 0 ? 'neg' : '', hint: o.budget.consumed_pct !== null ? `${L.pct(o.budget.consumed_pct)} used` : '', href: `/finance/budgets${L.qs({ month: per.month })}` }),
      L.kpiCard(L.t('Upcoming commitments'), L.money(upc.unpaid_minor), { hint: `${upc.unpaid_count} due in 14 days`, href: '/finance/commitments' }),
      L.kpiCard('Invested', L.money(o.invested.net_minor), { hint: 'moved to your portfolio · not an expense', href: '/finance/portfolio' }),
      L.kpiCard('Left after investing', L.signed(o.left_after_investing_minor), { cls: o.left_after_investing_minor < 0 ? 'neg' : '', hint: 'net cash flow − invested', href: '/finance/portfolio' }),
      L.kpiCard('Portfolio value', o.portfolio.count ? (o.portfolio.value_minor || o.portfolio.all_valued ? L.money(o.portfolio.value_minor) : '—') : 'No portfolio', { hint: o.portfolio.count && o.portfolio.all_valued ? `${L.signed(o.portfolio.gain_minor)} vs money invested` : 'enter its value monthly', href: '/finance/portfolio' }),
      L.kpiCard('Expense count', String(t.expense_count), { hint: 'transactions', href: `/finance/expenses${L.qs({ from: per.from, to: per.to })}` }),
      L.kpiCard('Average daily spending', o.average_daily_spending_minor === null ? '—' : L.money(o.average_daily_spending_minor), { hint: o.elapsed_days ? `over ${o.elapsed_days} day${o.elapsed_days > 1 ? 's' : ''}` : 'period has not started', href: `/finance/expenses${L.qs({ from: per.from, to: per.to, view: 'daily' })}` })));
    const notes = [];
    if (o.future_dated_excluded) notes.push(`${o.future_dated_excluded} future-dated transaction(s) in this period are not counted yet (Settings → Finance to change).`);
    if (o.expected_income.count) notes.push(`${L.money(o.expected_income.total_minor)} of expected income (${o.expected_income.count}) is not counted until you mark it received.`);
    if (notes.length) root.append(h('div', { class: 'insight warn' }, h('div', {}, notes.join(' '))));
    if (o.insights.length) root.append(h('div', { class: 'card', style: 'margin-bottom:16px' }, h('h2', {}, 'Insights'), ...o.insights.map(i => h('div', { class: 'insight ' + sev(i.severity) }, h('span', { class: 'tag' }, i.kind === 'projection' ? 'Projection' : 'Actual'), h('div', {}, i.text))),
      h('div', { class: 'small muted' }, 'Insights use only your recorded data and simple arithmetic. Projections are estimates, not predictions.')));
    // charts
    const mk = () => h('div', { class: 'chart-box' });
    const c1 = mk(), c2 = mk(), c3 = mk(), c4 = mk(), c5 = mk(), c6 = mk();
    root.append(h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', {}, 'Income vs expenses by month'), c1), h('div', { class: 'card' }, h('h2', {}, 'Daily spending'), c2),
      h('div', { class: 'card' }, h('h2', {}, 'Expenses by category'), o.categories.length ? c3 : L.empty('No spending in this period'), o.categories.length ? h('div', { class: 'small muted', style: 'margin-top:6px' }, 'Click a slice to open that category.') : null),
      h('div', { class: 'card' }, h('h2', {}, 'Budget vs actual'), o.budgets.length ? c4 : L.empty('No budgets for this month', per.is_single_month ? h('a', { href: `#/finance/budgets?month=${per.month}` }, 'Set a budget') : 'Select a single month to compare budgets'), ),
      h('div', { class: 'card' }, h('h2', {}, 'Savings over time'), c5), h('div', { class: 'card' }, h('h2', {}, 'Cash flow over time'), c6)));
    // sizes: ensure charts after attach
    const m = o.monthly;
    L.chart(c1, 'bar', { labels: m.map(x => L.fmtMonth(x.month)), datasets: [{ label: 'Income', data: m.map(x => x.income_minor), backgroundColor: L.colors.ok, borderRadius: 4 }, { label: 'Expenses', data: m.map(x => x.expense_minor), backgroundColor: L.colors.accent, borderRadius: 4 }] }, { yTick: L.moneyTick, tooltip: L.moneyTip, label: 'Income versus expenses by month' });
    const dd = o.daily; if (dd.length) L.chart(c2, 'line', { labels: dd.map(x => x.date.slice(5)), datasets: [{ label: 'Spending', data: dd.map(x => x.total_minor), borderColor: L.colors.accent, backgroundColor: 'rgba(230,81,0,.15)', fill: true, tension: .25, pointRadius: dd.length > 40 ? 0 : 3 }] }, { yTick: L.moneyTick, tooltip: L.moneyTip, legend: false, label: 'Daily spending' }); else L.mount(c2, L.empty('Daily view is available for ranges up to 400 days'));
    if (o.categories.length) L.chart(c3, 'doughnut', { labels: o.categories.map(x => x.name), datasets: [{ data: o.categories.map(x => Math.max(0, x.net_minor)), backgroundColor: o.categories.map(x => x.color), borderWidth: 0 }] }, { tooltip: { label: ctx => `${ctx.label}: ${L.money(ctx.parsed)}` }, options: { onClick: (e, els) => { if (els.length) L.go('/finance/expenses', { category_id: o.categories[els[0].index].category_id, from: per.from, to: per.to }); } }, label: 'Expenses by category' });
    if (o.budgets.length) L.chart(c4, 'bar', { labels: o.budgets.map(b => b.name), datasets: [{ label: 'Planned', data: o.budgets.map(b => b.amount_minor), backgroundColor: L.colors.muted, borderRadius: 4 }, { label: 'Actual', data: o.budgets.map(b => b.actual_minor), backgroundColor: o.budgets.map(b => b.overspent ? L.colors.bad : L.colors.accent), borderRadius: 4 }] }, { yTick: L.moneyTick, tooltip: L.moneyTip, label: 'Budget versus actual' });
    L.chart(c5, 'line', { labels: m.map(x => L.fmtMonth(x.month)), datasets: [{ label: 'Cumulative savings contributions', data: m.map(x => x.cumulative_contributions_minor), borderColor: L.colors.ok, tension: .2 }, { label: 'Cumulative net cash flow (12 months)', data: m.map(x => x.cumulative_net_minor), borderColor: L.colors.info, borderDash: [5, 4], tension: .2 }] }, { yTick: L.moneyTick, tooltip: L.moneyTip, beginAtZero: false, label: 'Savings over time' });
    L.chart(c6, 'bar', { labels: m.map(x => L.fmtMonth(x.month)), datasets: [{ label: 'Net cash flow', data: m.map(x => x.net_cash_flow_minor), backgroundColor: m.map(x => x.net_cash_flow_minor >= 0 ? L.colors.ok : L.colors.bad), borderRadius: 4 }] }, { yTick: L.moneyTick, tooltip: L.moneyTip, legend: false, beginAtZero: true, label: 'Cash flow over time' });

    // comparison + budgets list + commitments + accounts + savings
    const left = h('div', { class: 'stack' }), right = h('div', { class: 'stack' });
    if (o.compare) {
      const c = o.compare;
      left.append(h('div', { class: 'card' }, h('h2', {}, 'Category trends vs previous period'), h('p', { class: 'small muted', style: 'margin-top:0' }, c.note),
        L.table({ columns: [{ label: 'Category', render: r => h('span', { class: 'row', style: 'gap:6px' }, L.statusDot(r.color), r.name) }, { label: L.fmtMonth(c.month), money: true, render: r => L.money(r.current_minor) },
          { label: c.is_current_month ? 'Last month, same days' : 'Last month', money: true, render: r => L.money(c.is_current_month ? r.previous_comparable_minor : r.previous_full_minor) }, { label: 'Change', money: true, render: r => r.change_pct === null ? h('span', { class: 'muted' }, 'n/a') : h('span', { class: r.change_pct > 0 ? 'neg' : 'pos' }, L.ltr((r.change_pct > 0 ? '+' : '') + r.change_pct + '%')) }],
          rows: c.categories.slice(0, 10), empty: 'No category data yet' }),
        c.is_current_month ? h('div', { class: 'small muted', style: 'margin-top:8px' }, `Full previous month: ${L.money(c.previous_full.expense_minor)} spent.`) : null));
    }
    if (o.projection) { const p = o.projection; right.append(h('div', { class: 'card' }, h('h2', {}, 'Month-end projection'), p.sufficient ? h('div', {}, h('div', { class: 'num', style: 'font-size:22px;font-weight:700' }, L.money(p.projected_month_end_minor)), h('div', { class: 'small muted' }, 'estimated expenses at month end')) : h('div', { class: 'muted' }, 'Not enough activity yet for a useful estimate.'), h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'chip' }, `Actual so far: ${L.money(p.actual_to_date_minor)}`)), h('div', { class: 'formula' }, p.explanation))); }
    right.append(h('div', { class: 'card' }, h('h2', {}, 'Upcoming commitments', h('span', { class: 'sp' }), h('a', { href: '#/finance/commitments', class: 'small' }, 'Manage')),
      upc.items.length ? h('div', {}, ...upc.items.slice(0, 6).map(i => h('div', { class: 'list-item' }, h('div', { class: 'grow' }, h('div', {}, i.name), h('div', { class: 'small muted' }, `Due ${L.fmtDate(i.due_date)}`)), h('div', { class: 'num' }, L.money(i.remaining_minor))))) : h('div', { class: 'muted' }, 'Nothing due in the next 14 days.'),
      h('div', { class: 'small muted', style: 'margin-top:6px' }, 'Commitments are scheduled obligations, not expenses, until you record the payment.')));
    if (o.savings_goal) { const g = o.savings_goal; right.append(h('div', { class: 'card kpi', onclick: () => L.go('/finance/savings') }, h('h2', {}, 'Savings goal'), h('div', { class: 'row between' }, h('b', {}, g.name), h('span', { class: 'num' }, L.pct(g.progress_pct))), L.progress(g.progress_pct, { cls: 'ok' }), h('div', { class: 'small muted', style: 'margin-top:6px' }, `${L.money(g.current_minor)} of ${L.money(g.target_minor)}`, g.required_monthly_minor ? ` · need ${L.money(g.required_monthly_minor)}/month` : ''))); }
    right.append(h('div', { class: 'card' }, h('h2', {}, 'Accounts'), o.accounts.length ? h('div', {}, ...o.accounts.filter(a => a.status === 'active' && a.account_type !== 'investment').map(a => h('div', { class: 'list-item' }, h('div', { class: 'grow' }, a.name, h('span', { class: 'small muted' }, ' · ' + a.account_type.replace('_', ' '))), h('div', { class: 'num ' + (a.balance_minor < 0 ? 'neg' : '') }, L.money(a.balance_minor)))),
      h('div', { class: 'small muted', style: 'margin-top:6px' }, 'Calculated from your opening balance and recorded transactions. Not a verified bank balance. Portfolios are listed separately and are not counted as available money.')) : h('div', { class: 'muted' }, 'No accounts yet. Account tracking is optional — add accounts in Settings.')));
    root.append(h('div', { class: 'split', style: 'margin-top:14px' }, left, right));
    return root;
  };

  // ================= Transactions / Income / Expenses =================
  const FILTER_KEYS = ['q', 'from', 'to', 'category_id', 'subcategory_id', 'account_id', 'payment_method', 'essential', 'status', 'type', 'source', 'tag', 'commitment_id', 'min', 'max'];
  const stateStore = {};

  function txnRow(t, ctx) {
    const sign = t.type === 'expense' ? -1 : t.type === 'income' || t.type === 'refund' ? 1 : 0; const isExpected = t.status === 'expected';
    const amt = h('span', { class: (sign < 0 ? '' : sign > 0 ? 'pos' : 'muted') + (isExpected ? ' muted' : '') }, (t.type === 'transfer' ? '⇄ ' : sign > 0 ? '+' : sign < 0 ? '−' : t.direction === 'out' ? '−' : '+') + L.num(t.amount_minor, true));
    const chips = [];
    if (t.type === 'refund') chips.push(L.badge('Refund', 'ok')); if (t.type === 'transfer') { const dep = t.to_account_type === 'investment' && t.account_type !== 'investment', wd = t.account_type === 'investment' && t.to_account_type !== 'investment'; chips.push(L.badge(dep ? 'Invested' : wd ? 'Withdrawn from portfolio' : 'Transfer', dep || wd ? 'info' : '')); chips.push(L.badge(`${t.account_name} → ${t.to_account_name}`)); } if (t.type === 'adjustment') chips.push(L.badge('Adjustment'));
    if (isExpected) chips.push(L.badge('Expected', 'warn')); if (t.recurring) chips.push(L.badge('↻ Recurring')); if (t.commitment_name) chips.push(L.badge('Commitment: ' + t.commitment_name, 'info'));
    if (t.essential === 1) chips.push(L.badge('Essential')); if (t.essential === 0) chips.push(L.badge('Discretionary')); (t.tags || []).slice(0, 3).forEach(g => chips.push(L.badge('#' + g)));
    if (t.refunded_minor) chips.push(L.badge(`Refunded ${L.money(t.refunded_minor)}`, 'ok'));
    const cb = h('input', { type: 'checkbox', 'aria-label': 'Select transaction', checked: ctx.selected.has(t.id), onchange: e => { e.target.checked ? ctx.selected.add(t.id) : ctx.selected.delete(t.id); ctx.updateBulk(); } });
    const acts = h('div', { class: 'row', style: 'gap:4px;flex-wrap:nowrap' });
    if (isExpected) acts.append(h('button', { class: 'btn sm primary', onclick: () => L.openReceive(t) }, 'Mark received'));
    if (t.type === 'expense') acts.append(h('button', { class: 'btn sm', title: 'Record a refund', onclick: () => L.openRefund(t) }, 'Refund'));
    if (['expense', 'income'].includes(t.type)) acts.append(h('button', { class: 'btn sm', 'aria-label': 'Edit', onclick: () => L.openTxnForm(t.type, { txn: t }) }, L.t('Edit')));
    acts.append(h('button', { class: 'btn sm danger', 'aria-label': 'Delete', onclick: async () => { if (await L.confirmDelete(`“${t.description}” (${L.money2(t.amount_minor)})`)) { try { await L.del('/fin/transactions/' + t.id); L.toast('Deleted'); ctx.reload(); } catch (e) { L.fail(e); } } } }, L.t('Delete')));
    acts.append(h('button', { class: 'btn sm ghost', title: 'Change history', onclick: () => showAudit(t) }, '⏱'));
    return h('tr', {}, h('td', {}, cb), h('td', { class: 'nowrap' }, h('div', {}, L.fmtDate(t.txn_date)), h('div', { class: 'small muted' }, L.fmtTime(t.txn_time))),
      h('td', {}, h('div', {}, t.description, t.notes ? h('span', { title: t.notes, class: 'muted', 'aria-label': 'Has notes' }, ' ✎') : null), h('div', { class: 'row', style: 'gap:4px;margin-top:2px' }, t.merchant ? h('span', { class: 'small muted' }, t.merchant) : null, ...chips.slice(0, 5))),
      h('td', {}, t.category_name ? h('span', { class: 'row', style: 'gap:6px' }, L.statusDot(t.category_color), t.category_name, t.subcategory_name ? h('span', { class: 'small muted' }, '/ ' + t.subcategory_name) : null) : ''),
      h('td', { class: 'small' }, [t.account_name, t.payment_method].filter(Boolean).join(' · ')), h('td', { class: 'money num nowrap' }, amt), h('td', {}, acts));
  }
  async function showAudit(t) {
    const rows = await L.get(`/fin/transactions/${t.id}/audit`);
    const entry = r => {
      const b = r.before_json ? JSON.parse(r.before_json) : null, a = r.after_json ? JSON.parse(r.after_json) : null; const diffs = [];
      if (b && a) Object.keys(a).forEach(k => { if (JSON.stringify(a[k]) !== JSON.stringify(b[k]) && !['updated_at', 'tags'].includes(k)) diffs.push(`${k}: ${b[k] ?? '—'} → ${a[k] ?? '—'}`); });
      const snap = a || b; const detail = diffs.length ? diffs.join(' · ') : (snap ? `${snap.description} · ${L.money2(snap.amount_minor)} · ${snap.txn_date}` : '');
      return h('div', { class: 'list-item' }, h('div', { class: 'grow' }, h('b', {}, r.action), ' ', h('span', { class: 'small muted' }, L.dt(r.at)), h('div', { class: 'small' }, detail)));
    };
    L.modal({ title: 'Change history', wide: true, body: rows.length ? h('div', {}, ...rows.map(entry)) : L.empty('No history') });
  }

  function txnList(cfg, f, extraTop) {
    const wrap = h('div', {}); const selected = new Set(); let data = null; let limit = 100;
    const filtersState = { ...f };
    const sortState = { key: filtersState.sort || 'date', dir: filtersState.dir || 'desc' };
    const body = h('div', {}); const totalsEl = h('div', { class: 'row small', style: 'margin:8px 0;gap:14px' }); const bulkBar = h('div', { class: 'row card flat', style: 'display:none;margin-bottom:10px' });
    const apply = () => { const p = { ...filtersState, sort: sortState.key, dir: sortState.dir }; FILTER_KEYS.forEach(k => { if (p[k] === '') delete p[k]; }); sessionStorage.setItem('txnf_' + cfg.key, JSON.stringify(filtersState)); return p; };
    const updateBulk = () => { bulkBar.style.display = selected.size ? '' : 'none'; L.clear(bulkBar); if (!selected.size) return; const cat = L.select(L.catOptions('expense', { blankLabel: 'Change category…' }), '', { style: 'width:auto', onchange: async e => { if (!e.target.value) return; if (!await L.confirm(`Move ${selected.size} transaction(s) to “${L.catName(Number(e.target.value))}”?`)) { e.target.value = ''; return; } try { await L.post('/fin/transactions/bulk', { ids: [...selected], action: 'set_category', value: Number(e.target.value) }); L.toast('Updated'); selected.clear(); load(); } catch (er) { L.fail(er); } } });
      bulkBar.append(h('b', {}, `${selected.size} selected`), cfg.expenseOnly ? cat : null, cfg.expenseOnly ? h('button', { class: 'btn sm', onclick: async () => { try { await L.post('/fin/transactions/bulk', { ids: [...selected], action: 'set_essential', value: 1 }); L.toast('Marked essential'); selected.clear(); load(); } catch (er) { L.fail(er); } } }, 'Mark essential') : null, cfg.expenseOnly ? h('button', { class: 'btn sm', onclick: async () => { try { await L.post('/fin/transactions/bulk', { ids: [...selected], action: 'set_essential', value: 0 }); L.toast('Marked discretionary'); selected.clear(); load(); } catch (er) { L.fail(er); } } }, 'Mark discretionary') : null,
        h('button', { class: 'btn sm danger', onclick: async () => { if (await L.confirm(`Delete ${selected.size} transaction(s)? All of them are removed together, and each deletion is kept in the history.`, { danger: true, okLabel: 'Delete all' })) { try { await L.post('/fin/transactions/bulk', { ids: [...selected], action: 'delete' }); L.toast('Deleted'); selected.clear(); load(); } catch (er) { L.fail(er); } } } }, 'Delete selected'), h('button', { class: 'btn sm ghost', onclick: () => { selected.clear(); render(); } }, 'Clear')); };
    const ctx = { selected, updateBulk, reload: () => load() };
    const render = () => {
      const d = data; const t = d.totals;
      L.mount(totalsEl, cfg.expenseOnly ? [h('span', {}, 'Net spending: ', h('b', { class: 'num' }, L.money2(t.net_expense_minor))), h('span', { class: 'muted' }, `${t.expense_count} expense${t.expense_count === 1 ? '' : 's'}`), t.avg_expense_minor !== null ? h('span', { class: 'muted' }, `average ${L.money2(t.avg_expense_minor)}`) : null, t.refund_minor ? h('span', { class: 'muted' }, `refunds ${L.money2(t.refund_minor)}`) : null]
        : cfg.incomeOnly ? [h('span', {}, 'Total: ', h('b', { class: 'num' }, L.money2(t.income_minor))), h('span', { class: 'muted' }, `${t.income_count} transaction${t.income_count === 1 ? '' : 's'}`), t.avg_income_minor !== null ? h('span', { class: 'muted' }, `average ${L.money2(t.avg_income_minor)}`) : null]
          : [h('span', {}, `${t.count} transaction${t.count === 1 ? '' : 's'}`), h('span', { class: 'muted' }, `income ${L.money2(t.income_minor)}`), h('span', { class: 'muted' }, `net spending ${L.money2(t.net_expense_minor)}`)]);
      const all = h('input', { type: 'checkbox', 'aria-label': 'Select all', onchange: e => { d.rows.forEach(r => e.target.checked ? selected.add(r.id) : selected.delete(r.id)); render(); updateBulk(); } });
      const th = (label, key, cls) => h('th', { class: (cls || '') + (key ? ' sortable' : ''), 'aria-sort': sortState.key === key ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : null, onclick: key ? () => { if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'; else { sortState.key = key; sortState.dir = key === 'date' || key === 'amount' || key === 'updated' ? 'desc' : 'asc'; } load(); } : null }, label, sortState.key === key ? (sortState.dir === 'asc' ? ' ▲' : ' ▼') : '');
      L.mount(body, d.rows.length ? h('div', { class: 'tbl-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, all), th('Date', 'date'), th('Description', 'description'), th('Category', 'category'), h('th', {}, 'Account / method'), th('Amount', 'amount', 'money'), h('th', {}, ''))), h('tbody', {}, d.rows.map(r => txnRow(r, ctx)))),
        d.rows.length >= limit ? h('div', { class: 'row end', style: 'padding:10px' }, h('button', { class: 'btn', onclick: () => { limit += 200; load(); } }, 'Show more')) : null)
        : L.empty(Object.keys(filtersState).some(k => filtersState[k] && FILTER_KEYS.includes(k)) ? 'No transactions match these filters' : cfg.emptyTitle, Object.keys(filtersState).some(k => filtersState[k] && FILTER_KEYS.includes(k)) ? 'Try widening the date range or clearing filters.' : cfg.emptyText, h('button', { class: 'btn primary', onclick: () => cfg.incomeOnly ? L.openIncome() : L.openExpense() }, cfg.incomeOnly ? 'Add income' : 'Add expense')));
      updateBulk();
    };
    const load = async () => { try { L.mount(body, L.loading()); data = await L.get('/fin/transactions' + L.qs({ ...apply(), limit })); render(); } catch (e) { L.mount(body, h('div', { class: 'form-err' }, e.message)); } };
    // filters UI
    const mkIn = (key, props) => { const el = h('input', { ...props, value: filtersState[key] || '' }); el.addEventListener(props.type === 'date' ? 'change' : 'input', L.debounce(() => { filtersState[key] = el.value; load(); }, props.type === 'date' ? 0 : 300)); return el; };
    const sel = (key, opts) => L.select(opts, filtersState[key] || '', { onchange: e => { filtersState[key] = e.target.value; if (key === 'category_id') delete filtersState.subcategory_id; load(); } });
    const kind = cfg.incomeOnly ? 'income' : 'expense';
    const subs = (L.fcats.find(c => c.id === Number(filtersState.category_id)) || { subcategories: [] }).subcategories;
    const fbar = h('div', { class: 'filters no-print' }, L.field('Search', mkIn('q', { type: 'search', placeholder: 'Description, merchant, notes…' })), L.field('From', mkIn('from', { type: 'date' })), L.field('To', mkIn('to', { type: 'date' })),
      cfg.allTypes ? L.field('Type', sel('type', [{ value: '', label: 'All types' }, ...['income', 'expense', 'refund', 'transfer', 'adjustment'].map(x => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))])) : null,
      cfg.allTypes ? null : L.field('Category', sel('category_id', L.catOptions(kind, { blankLabel: 'All categories' }))), cfg.allTypes ? L.field('Category', sel('category_id', [{ value: '', label: 'All categories' }, ...L.fcats.map(c => ({ value: c.id, label: `${c.name}${c.kind === 'income' ? ' (income)' : ''}`, group: c.kind === 'income' ? 'Income' : (c.group_name || 'Expenses') }))])) : null,
      !cfg.incomeOnly && subs.length ? L.field('Subcategory', sel('subcategory_id', [{ value: '', label: 'All' }, ...subs.map(s => ({ value: s.id, label: s.name }))])) : null,
      cfg.incomeOnly ? L.field('Source', mkIn('source', { placeholder: 'Source or payer' })) : L.field('Payment method', mkIn('payment_method', { placeholder: 'e.g. Cash' })),
      L.field('Account', sel('account_id', L.accountOptions('All accounts'))), cfg.expenseOnly ? L.field('Classification', sel('essential', [{ value: '', label: 'All' }, { value: '1', label: 'Essential' }, { value: '0', label: 'Discretionary' }])) : null,
      L.field('Status', sel('status', [{ value: '', label: 'Any status' }, { value: 'posted', label: 'Confirmed' }, { value: 'expected', label: 'Expected' }])),
      h('button', { class: 'btn', onclick: () => { Object.keys(filtersState).forEach(k => { if (FILTER_KEYS.includes(k)) delete filtersState[k]; }); if (cfg.fixedType) filtersState.type = cfg.fixedType; sessionStorage.removeItem('txnf_' + cfg.key); L.refresh(); } }, 'Clear filters'),
      h('button', { class: 'btn', onclick: () => L.download(`/api/export/csv/transactions${L.qs(apply())}`) }, 'Export CSV'));
    wrap.append(extraTop || '', fbar, totalsEl, bulkBar, h('div', { class: 'card', style: 'padding:6px' }, body)); load(); return wrap;
  }

  function filtersFrom(q, cfg) {
    let saved = {}; if (!Object.keys(q).some(k => FILTER_KEYS.includes(k))) { try { saved = JSON.parse(sessionStorage.getItem('txnf_' + cfg.key)) || {}; } catch { saved = {}; } }
    const f = { ...saved }; FILTER_KEYS.forEach(k => { if (q[k]) f[k] = q[k]; }); f.type = cfg.fixedType; if (cfg.allTypes) { f.type = q.type || saved.type || ''; } return f;
  }

  L.routes['/finance/transactions'] = async (q) => {
    const cfg = { key: 'all', allTypes: true, emptyTitle: 'No transactions yet', emptyText: 'Everything you record — income, expenses, refunds and transfers — appears here.' };
    return h('div', {}, h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, L.t('Transactions')), h('p', { class: 'sub-t', style: 'margin:0' }, 'The complete ledger. Dates shown are the real transaction dates.')),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => L.openTransfer() }, 'Transfer'))), txnList(cfg, filtersFrom(q, cfg)));
  };

  L.routes['/finance/expenses'] = async (q) => {
    const view = q.view === 'daily' ? 'daily' : 'list';
    const cfg = { key: 'exp', fixedType: 'expense,refund', expenseOnly: true, emptyTitle: 'No expenses recorded yet', emptyText: 'Type what you bought, the amount and a category above, then press Enter.' };
    const root = h('div', {}, h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, L.t('Expenses')), h('p', { class: 'sub-t', style: 'margin:0' }, 'Record purchases in seconds. Shortcut: Alt+E opens the full form from anywhere. Money you move into your investment portfolio is not an expense: use + Invest (Alt+V).')),
      h('div', { class: 'tabs', style: 'margin:0;border:0' }, h('button', { class: view === 'list' ? 'active' : '', onclick: () => L.go('/finance/expenses', { view: 'list' }) }, 'All expenses'), h('button', { class: view === 'daily' ? 'active' : '', onclick: () => L.go('/finance/expenses', { view: 'daily', date: q.date }) }, 'By day'))));
    if (view === 'list') { root.append(L.quickExpenseBar({ date: undefined }), h('div', { style: 'height:12px' }), txnList(cfg, filtersFrom(q, cfg))); return root; }
    root.append(await dailyView(q)); return root;
  };

  async function dailyView(q) {
    const date = q.date || L.today(); const month = date.slice(0, 7); const mfrom = `${month}-01`, mto = L.monthEnd(month);
    const [days, list] = await Promise.all([L.get('/fin/daily' + L.qs({ from: mfrom, to: mto })), L.get('/fin/transactions' + L.qs({ from: date, to: date, type: 'expense,refund', limit: 500, sort: 'date', dir: 'asc' }))]);
    const day = days.find(d => d.date === date) || { total_minor: 0, count: 0, essential_minor: 0, discretionary_minor: 0, categories: [] };
    const nav = h('div', { class: 'row pill-nav', style: 'margin-bottom:12px' }, h('button', { class: 'btn icon', 'aria-label': 'Previous day', onclick: () => L.go('/finance/expenses', { view: 'daily', date: L.addDays(date, -1) }) }, '‹'),
      h('input', { type: 'date', value: date, style: 'width:auto', 'aria-label': 'Pick a date', onchange: e => e.target.value && L.go('/finance/expenses', { view: 'daily', date: e.target.value }) }), h('button', { class: 'btn icon', 'aria-label': 'Next day', onclick: () => L.go('/finance/expenses', { view: 'daily', date: L.addDays(date, 1) }) }, '›'),
      date !== L.today() ? h('button', { class: 'btn sm', onclick: () => L.go('/finance/expenses', { view: 'daily' }) }, 'Today') : null, h('b', { style: 'margin-inline-start:8px' }, L.fmtDate(date, true)), h('span', { class: 'sp', style: 'flex:1' }),
      h('button', { class: 'btn primary', onclick: () => L.openExpense({ defaults: { txn_date: date } }) }, `+ Add expense on ${L.fmtDate(date)}`));
    const sel = new Set(); const ctx = { selected: sel, updateBulk() {}, reload: () => L.refresh() };
    const bd = day.daily_budget_minor !== null && day.daily_budget_minor !== undefined;
    const maxDay = Math.max(1, ...days.map(d => d.total_minor));
    return h('div', {}, nav, h('div', { class: 'cards', style: 'margin-bottom:14px' }, L.kpiCard('Spending', L.money2(day.total_minor), { hint: `${day.count} transaction${day.count === 1 ? '' : 's'}` }), L.kpiCard('Essential', L.money2(day.essential_minor)), L.kpiCard('Discretionary', L.money2(day.discretionary_minor)),
      bd ? L.kpiCard('Daily budget', L.money(day.daily_budget_minor), { hint: day.budget_diff_minor > 0 ? `${L.money(day.budget_diff_minor)} over` : `${L.money(-day.budget_diff_minor)} under`, cls: day.budget_diff_minor > 0 ? 'neg' : 'pos' }) : L.kpiCard('Daily budget', 'Not set', { hint: 'Settings → Finance', href: '/settings' })),
      h('div', { class: 'split' }, h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('h2', {}, `Transactions on ${L.fmtDate(date)}`), list.rows.length ? h('div', { class: 'tbl-wrap' }, h('table', {}, h('tbody', {}, list.rows.map(r => { const row = txnRow(r, ctx); row.removeChild(row.firstChild); return row; })))) : L.empty('No expenses on this day', 'Missed something? Add it with the button above — it will be stored on this date.')),
        day.categories.length ? h('div', { class: 'card' }, h('h2', {}, 'By category'), ...day.categories.map(c => h('div', { class: 'list-item' }, L.statusDot(c.color), h('div', { class: 'grow' }, c.name), h('div', { class: 'num' }, L.money2(c.net_minor))))) : null),
        h('div', { class: 'card' }, h('h2', {}, L.fmtMonth(month)), h('div', { style: 'max-height:560px;overflow:auto' }, ...days.map(d => h('button', { class: 'list-item', style: `width:100%;background:${d.date === date ? 'var(--card2)' : 'none'};border:0;border-bottom:1px solid var(--line);cursor:pointer;text-align:start;padding:7px 6px`, onclick: () => L.go('/finance/expenses', { view: 'daily', date: d.date }) },
          h('div', { style: 'width:62px' }, h('b', {}, d.date.slice(8)), h('span', { class: 'small muted' }, ' ' + L.DAYS_SHORT[L.dow(d.date)])), h('div', { class: 'grow' }, L.progress(d.total_minor / maxDay * 100)), h('div', { class: 'num small', style: 'width:84px;text-align:end' }, d.total_minor ? L.num(d.total_minor, true) : '·')))))));
  }

  // ================= Income =================
  L.routes['/finance/income'] = async (q) => {
    const tab = q.tab === 'expected' ? 'expected' : 'history'; const now = L.today(); const mk = now.slice(0, 7);
    const [cur, yr, expected, tpl] = await Promise.all([L.get('/fin/transactions' + L.qs({ type: 'income', status: 'posted', from: `${mk}-01`, to: L.monthEnd(mk), limit: 1 })), L.get('/fin/transactions' + L.qs({ type: 'income', status: 'posted', from: `${now.slice(0, 4)}-01-01`, to: `${now.slice(0, 4)}-12-31`, limit: 1 })), L.get('/fin/transactions' + L.qs({ type: 'income', status: 'expected', limit: 200, sort: 'date', dir: 'asc' })), L.get('/fin/templates')]);
    const root = h('div', {}, h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, L.t('Income')), h('p', { class: 'sub-t', style: 'margin:0' }, 'Record money when it actually arrives. Expected income stays separate until you confirm it.')), h('button', { class: 'btn primary', onclick: () => L.openIncome() }, '+ ' + L.t('Add income'))),
      h('div', { class: 'cards', style: 'margin-bottom:14px' }, L.kpiCard('This month (confirmed)', L.money2(cur.totals.income_minor), { hint: `${cur.totals.income_count} transaction(s)` }), L.kpiCard(`${now.slice(0, 4)} year to date`, L.money2(yr.totals.income_minor), { hint: `${yr.totals.income_count} transaction(s)` }), L.kpiCard('Expected, not received', L.money2(expected.totals.income_minor), { hint: `${expected.totals.income_count} pending` })),
      h('div', { class: 'tabs' }, h('button', { class: tab === 'history' ? 'active' : '', onclick: () => L.go('/finance/income', { tab: 'history' }) }, 'Income history'), h('button', { class: tab === 'expected' ? 'active' : '', onclick: () => L.go('/finance/income', { tab: 'expected' }) }, `Expected and recurring${expected.rows.length ? ` (${expected.rows.length})` : ''}`)));
    if (tab === 'history') {
      const cfg = { key: 'inc', fixedType: 'income', incomeOnly: true, emptyTitle: 'No income recorded yet', emptyText: 'Add your salary or any money you receive, on the day it arrives.' };
      const f = filtersFrom(q, cfg); if (!f.status && !q.status) f.status = 'posted';
      // income by source summary for the current year
      const bySrc = await L.get('/fin/reports/income_by_source' + L.qs({ from: `${now.slice(0, 4)}-01-01`, to: `${now.slice(0, 4)}-12-31` }));
      const cmp = bySrc.rows.length ? h('div', { class: 'card', style: 'margin-bottom:12px' }, h('h2', {}, `Income by source, ${now.slice(0, 4)}`), ...bySrc.rows.slice(0, 6).map(r => h('div', { class: 'list-item' }, h('div', { class: 'grow' }, r.source, h('span', { class: 'small muted' }, ` · ${r.count} payment(s)`)), h('div', { style: 'width:160px' }, L.progress(r.share || 0)), h('div', { class: 'num', style: 'width:110px;text-align:end' }, L.money2(r.total_minor))))) : null;
      root.append(txnList(cfg, f, cmp));
    } else {
      root.append(h('div', { class: 'card', style: 'margin-bottom:14px' }, h('h2', {}, 'Expected income', h('span', { class: 'sp' }), h('button', { class: 'btn sm', onclick: () => L.openIncome({ defaults: { status: 'expected', txn_date: L.addDays(now, 7) } }) }, '+ Add expected')),
        h('p', { class: 'small muted', style: 'margin-top:0' }, 'These amounts are not counted in any total, savings rate or budget until you mark them as received.'),
        expected.rows.length ? L.table({ columns: [{ label: 'Expected date', render: r => L.fmtDate(r.txn_date) }, { label: 'Description', render: r => h('span', {}, r.description, r.template_id ? h('span', { class: 'chip', style: 'margin-inline-start:6px' }, '↻ from template') : null) }, { label: 'Source', key: 'source' }, { label: 'Amount', money: true, render: r => L.money2(r.amount_minor) },
          { label: '', render: r => h('div', { class: 'row', style: 'gap:4px;flex-wrap:nowrap' }, h('button', { class: 'btn sm primary', onclick: () => L.openReceive(r) }, 'Mark received'), h('button', { class: 'btn sm', onclick: () => L.openTxnForm('income', { txn: r }) }, 'Edit'), h('button', { class: 'btn sm danger', onclick: async () => { if (await L.confirmDelete(`“${r.description}”`)) { await L.del('/fin/transactions/' + r.id); L.refresh(); } } }, 'Delete')) }], rows: expected.rows }) : L.empty('Nothing expected right now')));
      root.append(h('div', { class: 'card' }, h('h2', {}, 'Recurring income templates', h('span', { class: 'sp' }), h('button', { class: 'btn sm primary', onclick: () => templateForm() }, '+ New template')),
        h('p', { class: 'small muted', style: 'margin-top:0' }, 'A template only creates expected entries for this and next month. Nothing is recorded as received automatically.'),
        tpl.length ? L.table({ columns: [{ label: 'Description', key: 'description' }, { label: 'Repeats', render: r => `${r.frequency}${r.day_of_month ? ` on day ${r.day_of_month}` : ''}` }, { label: 'Amount', money: true, render: r => L.money2(r.amount_minor) }, { label: 'Status', render: r => L.badge(r.active ? 'Active' : 'Paused', r.active ? 'ok' : '') },
          { label: '', render: r => h('div', { class: 'row', style: 'gap:4px' }, h('button', { class: 'btn sm', onclick: () => templateForm(r) }, 'Edit'), h('button', { class: 'btn sm danger', onclick: async () => { if (await L.confirmDelete(`template “${r.description}” (already created entries stay)`)) { await L.del('/fin/templates/' + r.id); L.refresh(); } } }, 'Delete')) }], rows: tpl }) : L.empty('No templates', 'Create one for income that arrives regularly, like a salary.')));
    }
    return root;
  };
  function templateForm(t) {
    t = t || {}; const desc = h('input', { value: t.description || '', placeholder: 'Monthly salary', maxlength: 200 }), amount = h('input', { inputmode: 'decimal', value: t.amount_minor ? L.minorToInput(t.amount_minor) : '' }), cat = L.select(L.catOptions('income'), t.category_id || ''), source = h('input', { value: t.source || '' }), freq = L.select(['weekly', 'monthly', 'quarterly', 'yearly'], t.frequency || 'monthly'), dom = h('input', { type: 'number', min: 1, max: 31, value: t.day_of_month || '' }), start = h('input', { type: 'date', value: t.start_date || L.today() }), end = h('input', { type: 'date', value: t.end_date || '' }), acc = L.select(L.accountOptions(), t.account_id || ''), active = h('input', { type: 'checkbox', checked: t.active !== 0 });
    L.modal({ title: t.id ? 'Edit template' : 'New recurring income template', body: h('div', { class: 'fgrid' }, L.field('Description', desc, { req: true, cls: 'wide' }), L.field('Amount', amount, { req: true }), L.field('Category', cat, { req: true }), L.field('Source or payer', source), L.field('Account', acc), L.field('Repeats', freq), L.field('Day of month', dom, { hint: 'Leave empty to use the start date’s day' }), L.field('Start date', start, { req: true }), L.field('End date', end), h('label', { class: 'row', style: 'gap:6px' }, active, 'Active')),
      actions: [{ label: 'Cancel' }, { label: 'Save template', class: 'primary', onClick: async () => { const body = { description: desc.value, amount: amount.value, category_id: Number(cat.value) || null, source: source.value, frequency: freq.value, day_of_month: dom.value || null, start_date: start.value, end_date: end.value || null, account_id: acc.value || null, active: active.checked };
        t.id ? await L.put('/fin/templates/' + t.id, body) : await L.post('/fin/templates', body); if (t.id) await L.post('/system/tick'); L.toast('Template saved'); L.refresh(); } }] });
  }
})();
