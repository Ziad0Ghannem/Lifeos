'use strict';
(function () {
  const { h } = L;
  const bump = async () => { await L.loadRefs(); L.refresh(); };
  const gainCls = v => v === null || v === undefined || v === 0 ? '' : v > 0 ? 'pos' : 'neg';
  const signedPct = v => v === null || v === undefined ? '—' : L.ltr(`${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}%`);

  L.routes['/finance/portfolio'] = async () => {
    const sum = await L.get('/fin/portfolios'); const details = await Promise.all(sum.portfolios.map(p => L.get('/fin/portfolios/' + p.id)));
    const root = h('div', {}, h('div', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', {}, 'Investment Portfolio'), h('p', { class: 'sub-t', style: 'margin:0' }, 'A separate pot funded from your salary account. It is not part of the money you have, and it never appears in your expenses.')),
      h('div', { class: 'row' }, sum.portfolios.length ? h('button', { class: 'btn primary', onclick: () => L.openInvest() }, '+ Invest') : null, h('button', { class: 'btn', onclick: () => portfolioForm() }, '+ New portfolio'))));
    if (!sum.portfolios.length) { root.append(L.empty('No portfolio yet', 'Create a portfolio, then move money into it from your salary account each month and type in its value to see your gain or loss.', h('button', { class: 'btn primary', onclick: () => portfolioForm() }, 'Create a portfolio'))); return root; }
    const inv = sum.net_invested_minor; const cards = [L.kpiCard('Net invested', L.money(inv), { hint: 'deposits − withdrawals' }),
      L.kpiCard('Latest value', sum.value_minor || sum.all_valued ? L.money(sum.value_minor) : '—', { hint: sum.all_valued ? 'as you last entered it' : 'record a value to see it' }),
      L.kpiCard('Gain / loss', sum.gain_minor || sum.all_valued ? L.signed(sum.gain_minor) : '—', { cls: gainCls(sum.gain_minor), hint: sum.gain_pct === null ? '' : signedPct(sum.gain_pct) + ' on invested money' })];
    root.append(h('div', { class: 'cards', style: 'margin-bottom:16px' }, cards));
    details.forEach(d => root.append(portfolioCard(d)));
    return root;
  };

  function portfolioCard(d) {
    const lv = d.last_valuation; const stale = lv && d.stale_days > 35;
    const chartBox = h('div', { class: 'chart-box sm' }); const hasChart = d.history.length >= 1;
    const card = h('div', { class: 'card', style: 'margin-bottom:16px' },
      h('div', { class: 'row between' }, h('h2', { style: 'margin:0' }, d.name, d.status === 'closed' ? h('span', { class: 'chip', style: 'margin-inline-start:8px' }, 'Closed') : null),
        h('div', { class: 'row', style: 'gap:4px' }, h('button', { class: 'btn sm primary', onclick: () => L.openInvest(d) }, 'Add money'), h('button', { class: 'btn sm', onclick: () => moneyForm(d, 'out') }, 'Withdraw'), h('button', { class: 'btn sm', onclick: () => valuationForm(d) }, 'Record value'), h('button', { class: 'btn sm', onclick: () => portfolioForm(d) }, 'Edit'))),
      h('div', { class: 'grid g4', style: 'margin:14px 0' }, st('Net invested', L.money(d.net_invested_minor), `${L.money(d.deposits_minor)} in · ${L.money(d.withdrawals_minor)} out${d.opening_minor ? ` · ${L.money(d.opening_minor)} at start` : ''}`),
        st('Current value', lv ? L.money(lv.value_minor) : '—', lv ? `entered for ${L.fmtDate(lv.date)}` : 'no value entered yet'), st('Gain / loss', lv ? L.signed(d.gain_minor) : '—', lv ? 'value − money invested at that date' : '', gainCls(d.gain_minor)), st('Gain / loss %', lv ? signedPct(d.gain_pct) : '—', lv && d.gain_pct === null ? 'needs invested money' : '', gainCls(d.gain_pct))),
      stale ? h('div', { class: 'insight warn' }, h('div', {}, `The value was last entered ${d.stale_days} days ago. Record this month’s value to keep the gain and loss up to date.`)) : null,
      lv && d.flows_since_valuation_minor ? h('div', { class: 'small muted', style: 'margin-bottom:8px' }, `Since that value you ${d.flows_since_valuation_minor > 0 ? 'added' : 'withdrew'} ${L.money(Math.abs(d.flows_since_valuation_minor))}; it is not in the value above until you record a new value.`) : null,
      hasChart ? chartBox : null,
      d.history.length ? h('div', { style: 'margin-top:12px' }, L.table({ columns: [{ label: 'Date', render: r => L.fmtDate(r.date) }, { label: 'Net added', money: true, render: r => r.net_flow_minor ? L.signed(r.net_flow_minor) : '—' }, { label: 'Total invested', money: true, render: r => L.money(r.net_invested_minor) }, { label: 'Value', money: true, render: r => h('b', {}, L.money(r.value_minor)) },
        { label: 'Market effect', money: true, render: r => r.market_effect_minor === null ? h('span', { class: 'muted' }, '—') : h('span', { class: gainCls(r.market_effect_minor) }, L.signed(r.market_effect_minor)) }, { label: 'Return %', money: true, render: r => r.return_pct === null ? h('span', { class: 'muted' }, '—') : h('span', { class: gainCls(r.return_pct) }, signedPct(r.return_pct)) },
        { label: 'Total gain / loss', money: true, render: r => h('span', { class: gainCls(r.total_gain_minor) }, `${L.signed(r.total_gain_minor)}${r.total_gain_pct === null ? '' : ' (' + signedPct(r.total_gain_pct) + ')'}`) },
        { label: '', render: r => h('button', { class: 'btn sm danger', 'aria-label': 'Delete value', onclick: async () => { if (await L.confirmDelete(`the value entered for ${L.fmtDate(r.date)}`)) { await L.del('/fin/portfolio-valuations/' + r.id); L.refresh(); } } }, 'Delete') }], rows: [...d.history].reverse() }),
        h('div', { class: 'small muted', style: 'margin-top:8px' }, 'Market effect = change in value minus the money you added or withdrew in between. Return % = market effect ÷ (previous value + money added). The first value has no previous value, so it shows only the total gain.')) : L.empty('No values recorded', 'Type in what the portfolio is worth today (and again at each month end).', h('button', { class: 'btn primary', onclick: () => valuationForm(d) }, 'Record value')),
      d.flows.length ? h('details', { style: 'margin-top:10px' }, h('summary', {}, `Money moved (${d.flows.length})`), L.table({ columns: [{ label: 'Date', render: f => L.fmtDate(f.date) }, { label: 'Type', render: f => f.kind === 'deposit' ? L.badge('Deposit', 'info') : L.badge('Withdrawal', 'warn') }, { label: 'Account', key: 'counterpart' }, { label: 'Amount', money: true, render: f => L.money2(f.amount_minor) },
        { label: '', render: f => h('button', { class: 'btn sm danger', onclick: async () => { if (await L.confirmDelete(`this ${f.kind === 'deposit' ? 'deposit' : 'withdrawal'} (${L.money2(f.amount_minor)})`)) { await L.del('/fin/transactions/' + f.id); L.refresh(); } } }, 'Delete') }], rows: d.flows })) : null);
    if (hasChart) setTimeout(() => L.chart(chartBox, 'line', { labels: d.history.map(r => L.fmtDate(r.date)), datasets: [{ label: 'Value', data: d.history.map(r => r.value_minor), borderColor: L.colors.ok, backgroundColor: 'rgba(46,173,116,.12)', fill: true, tension: .2 }, { label: 'Money invested', data: d.history.map(r => r.net_invested_minor), borderColor: L.colors.muted, borderDash: [5, 4], stepped: true }] }, { yTick: L.moneyTick, tooltip: L.moneyTip, beginAtZero: false, label: 'Portfolio value versus money invested' }), 0);
    return card;
  }
  const st = (l, v, s, cls) => h('div', {}, h('div', { class: 'small muted' }, l), h('div', { class: 'num ' + (cls || ''), style: 'font-size:20px;font-weight:700' }, v), s ? h('div', { class: 'small muted' }, s) : null);

  function portfolioForm(d) {
    d = d || {}; const name = h('input', { value: d.name || '', maxlength: 60, autofocus: true, placeholder: 'e.g. Stocks' }), opening = h('input', { inputmode: 'decimal', value: d.opening_minor ? L.minorToInput(d.opening_minor) : '', placeholder: '0', disabled: !!d.id }), od = h('input', { type: 'date', value: L.today(), disabled: !!d.id });
    const status = L.select([{ value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }], d.status || 'active');
    L.modal({ title: d.id ? 'Edit portfolio' : 'New portfolio', body: h('div', { class: 'fgrid' }, L.field('Portfolio name', name, { req: true }), d.id ? L.field('Status', status) : null, d.id ? null : L.field('Already invested before tracking', opening, { hint: 'Optional. Money already in the portfolio today. Leave empty to start from zero.' }), d.id ? null : L.field('As of date', od)),
      actions: [{ label: 'Cancel' }, { label: 'Save', class: 'primary', onClick: async () => { if (d.id) await L.put('/fin/accounts/' + d.id, { name: name.value, status: status.value }); else await L.post('/fin/portfolios', { name: name.value, opening: opening.value, opening_date: od.value }); L.toast('Portfolio saved'); await bump(); } }] });
  }

  async function moneyForm(d, dir, presetPortfolio) {
    const accounts = L.accounts.filter(a => a.status === 'active' && a.account_type !== 'investment');
    if (!accounts.length) { L.modal({ title: dir === 'in' ? 'Add money to the portfolio' : 'Withdraw from the portfolio', body: h('div', {}, h('p', { style: 'margin-top:0' }, 'Money moves between accounts. Create the account the money comes from first (for example “Salary”).'), h('div', { class: 'small muted' }, 'This keeps your salary account balance correct and keeps the invested money out of your expenses.')), actions: [{ label: 'Cancel' }, { label: 'Create an account', class: 'primary', onClick: (m) => { m.close(); L.accountForm(); return false; }, close: false }] }); return; }
    const acc = L.select([{ value: '', label: 'Choose an account' }, ...accounts.map(a => ({ value: a.id, label: a.name }))], accounts.length === 1 ? accounts[0].id : (L.settings.last_invest_account || ''));
    const amount = h('input', { inputmode: 'decimal', placeholder: '0.00', autofocus: true }), date = h('input', { type: 'date', value: L.today() }), note = h('input', { maxlength: 200, placeholder: 'Optional' });
    L.modal({ title: dir === 'in' ? `Add money to ${d.name}` : `Withdraw from ${d.name}`, body: h('div', {}, h('p', { class: 'small muted', style: 'margin-top:0' }, dir === 'in' ? 'The amount leaves your account and goes into the portfolio. It is shown as “Invested”, not as an expense.' : 'The amount leaves the portfolio and returns to the account you choose.'), h('div', { class: 'fgrid' }, L.field(dir === 'in' ? 'From account' : 'To account', acc, { req: true }), L.field('Amount', amount, { req: true }), L.field('Date', date, { req: true }), L.field('Note', note))),
      actions: [{ label: 'Cancel' }, { label: dir === 'in' ? 'Add money' : 'Withdraw', class: 'primary', onClick: async () => { const path = `/fin/portfolios/${d.id}/` + (dir === 'in' ? 'deposit' : 'withdraw'); await L.post(path, { from_account_id: acc.value, to_account_id: acc.value, amount: amount.value, date: date.value, note: note.value.trim() || L.t((dir === 'in' ? 'Portfolio deposit: ' : 'Portfolio withdrawal: ') + d.name) }); L.put('/settings', { last_invest_account: acc.value }).catch(() => { }); L.toast(dir === 'in' ? 'Money added to the portfolio' : 'Withdrawal recorded'); await bump(); } }] });
  }
  L.openInvest = async function (d) {
    if (d && d.id) return moneyForm(d, 'in');
    const sum = await L.get('/fin/portfolios'); if (!sum.portfolios.length) { L.go('/finance/portfolio'); return L.toast('Create a portfolio first', 'warn'); }
    const active = sum.portfolios.filter(p => p.status === 'active'); if (active.length === 1) return moneyForm(active[0], 'in');
    const sel = L.select(active.map(p => ({ value: p.id, label: p.name })), active[0].id);
    L.modal({ title: 'Invest', body: L.field('Which portfolio?', sel), actions: [{ label: 'Cancel' }, { label: 'Continue', class: 'primary', onClick: (m) => { const p = active.find(x => x.id === Number(sel.value)); m.close(); moneyForm(p, 'in'); return false; }, close: false }] });
  };

  function valuationForm(d) {
    const date = h('input', { type: 'date', value: L.today(), max: L.today() }), value = h('input', { inputmode: 'decimal', placeholder: '0.00', autofocus: true, value: d.last_valuation ? L.minorToInput(d.last_valuation.value_minor) : '' }), note = h('input', { maxlength: 300, placeholder: 'Optional' });
    L.modal({ title: `Record value of ${d.name}`, body: h('div', {}, h('p', { class: 'small muted', style: 'margin-top:0' }, 'Type in what the whole portfolio is worth on that date, as shown by your broker. Entering the same date again replaces the earlier value.'), h('div', { class: 'fgrid' }, L.field('Date', date, { req: true }), L.field('Portfolio value', value, { req: true, hint: `Money invested so far: ${L.money(d.net_invested_minor)}` }), L.field('Note', note, { cls: 'wide' }))),
      actions: [{ label: 'Cancel' }, { label: 'Save value', class: 'primary', onClick: async () => { await L.post(`/fin/portfolios/${d.id}/valuations`, { date: date.value, value: value.value, note: note.value }); const nd = await L.get('/fin/portfolios/' + d.id); L.toast(nd.last_valuation ? `Saved. Gain / loss: ${L.signed(nd.gain_minor)}${nd.gain_pct === null ? '' : ' (' + signedPct(nd.gain_pct) + ')'}` : 'Value saved'); await bump(); } }] });
  }
})();
