'use strict';
(function () {
  const { h } = L;
  const PAY = ['Cash', 'Debit card', 'Credit card', 'Bank transfer', 'Mobile wallet', 'Other'];

  /** Create a transaction exactly once (client id makes retries safe) and handle the "looks like a duplicate" warning. */
  L.submitTxn = async (payload) => {
    try { return await L.post('/fin/transactions', payload); }
    catch (e) {
      if (e.code === 'DUPLICATE_SUSPECT') {
        const m = (e.data && e.data.matches) || [];
        const keep = await L.confirm(h('div', {}, h('p', { style: 'margin-top:0' }, 'A very similar transaction already exists. Identical purchases are allowed — keep both?'), ...m.map(x => h('div', { class: 'small muted' }, `${L.fmtDate(x.txn_date)} · ${x.description} · ${L.money2(x.amount_minor)}`))), { okLabel: 'Keep both', title: 'Possible duplicate' });
        if (!keep) { const err = new Error('Not saved — duplicate warning cancelled.'); err.cancelled = true; throw err; }
        return L.post('/fin/transactions', { ...payload, force: true });
      }
      throw e;
    }
  };
  const bump = async () => { await L.loadRefs(); L.refresh(); };

  L.openTxnForm = function (type, { txn, defaults = {}, onSaved, title } = {}) {
    const editing = !!txn; const isExp = type === 'expense'; const t = txn || {};
    let id = editing ? txn.id : L.uuid(); let busy = false;
    const lastCat = L.settings.last_expense_category ? Number(L.settings.last_expense_category) : '';
    const d = { description: t.description ?? defaults.description ?? '', amount: t.amount_minor !== undefined ? L.minorToInput(t.amount_minor) : (defaults.amount ?? ''), category_id: t.category_id ?? defaults.category_id ?? (isExp ? lastCat : ''), txn_date: t.txn_date ?? defaults.txn_date ?? L.today(), ...defaults };
    const catOpts = L.catOptions(type === 'income' ? 'income' : 'expense', { includeArchivedId: t.category_id, blankLabel: 'Select a category' });
    const desc = h('input', { value: d.description, placeholder: isExp ? 'What did you buy?' : 'What was this for?', maxlength: 200, autofocus: true, required: true, list: 'dl-desc', autocomplete: 'off' });
    const dl = h('datalist', { id: 'dl-desc' });
    const amount = h('input', { value: d.amount, inputmode: 'decimal', placeholder: '0.00', required: true, autocomplete: 'off', 'aria-label': 'Amount' });
    const cat = L.select(catOpts, d.category_id, { required: true }); let catTouched = !!d.category_id || editing; cat.addEventListener('change', () => { catTouched = true; sub.refill(); });
    const date = h('input', { type: 'date', value: d.txn_date, required: true });
    const time = h('input', { type: 'time', value: t.txn_time || '' });
    const sub = L.select([{ value: '', label: 'None' }], t.subcategory_id || ''); sub.refill = () => { const c = L.fcats.find(x => x.id === Number(cat.value)); const subs = (c ? c.subcategories.filter(s => !s.archived || s.id === t.subcategory_id) : []); const cur = sub.value; L.clear(sub); sub.append(h('option', { value: '' }, subs.length ? 'None' : 'No subcategories')); subs.forEach(s => sub.append(h('option', { value: s.id }, s.name))); sub.value = subs.some(s => String(s.id) === String(cur)) ? cur : (t.subcategory_id || ''); }; sub.refill();
    const merchant = h('input', { value: t.merchant || '', maxlength: 120, placeholder: isExp ? 'Store or vendor' : 'Optional' });
    const source = h('input', { value: t.source || '', maxlength: 120, placeholder: 'Employer, client, payer…', list: 'dl-src' }); const dlSrc = h('datalist', { id: 'dl-src' });
    const pay = h('input', { value: t.payment_method || '', list: 'dl-pay', maxlength: 40, placeholder: 'Cash, card…' }); const dlPay = h('datalist', { id: 'dl-pay' }, PAY.map(p => h('option', { value: p })));
    const account = L.select(L.accountOptions(), t.account_id || d.account_id || ''); const ess = L.select([{ value: '', label: 'Automatic (by category)' }, { value: '1', label: 'Essential' }, { value: '0', label: 'Discretionary' }], t.essential === null || t.essential === undefined ? '' : String(t.essential));
    const recurring = h('input', { type: 'checkbox', checked: !!t.recurring }); const notes = h('textarea', { maxlength: 2000, placeholder: 'Why? Anything worth remembering' }, t.notes || ''); const tags = h('input', { value: (t.tags || []).join(', '), placeholder: 'comma, separated' });
    const reference = h('input', { value: t.reference || '', maxlength: 80 });
    const status = L.select([{ value: 'posted', label: 'Confirmed (received)' }, { value: 'expected', label: 'Expected (not received yet)' }], t.status || d.status || 'posted');
    const cpay = L.select([{ value: '', label: 'Not linked to a commitment' }], t.commitment_payment_id || d.commitment_payment_id || '');
    const err = h('div', { class: 'err', role: 'alert' });

    L.get('/fin/payment-methods').then(ms => ms.filter(m => !PAY.includes(m)).forEach(m => dlPay.append(h('option', { value: m })))).catch(() => {});
    if (!isExp) L.get('/fin/sources').then(ss => ss.forEach(s => dlSrc.append(h('option', { value: s })))).catch(() => {});
    if (isExp) L.get('/fin/commitments').then(cs => { cs.filter(c => c.status === 'active').forEach(c => c.payments.filter(p => !p.skipped && (p.status !== 'paid' || p.id === t.commitment_payment_id)).slice(0, 24).forEach(p => cpay.append(h('option', { value: p.id }, `${c.name} · #${p.seq} · due ${L.fmtDate(p.due_date)} · ${L.money2(p.remaining_minor || p.amount_minor)}`)))); cpay.value = t.commitment_payment_id || d.commitment_payment_id || ''; }).catch(() => {});
    if (isExp && !editing) {
      const look = L.debounce(async () => { const q = desc.value.trim(); if (q.length < 2) return; try { const s = await L.get('/fin/suggest?q=' + encodeURIComponent(q)); L.clear(dl); s.forEach(x => dl.append(h('option', { value: x.description }))); const exact = s.find(x => x.description.toLowerCase() === q.toLowerCase()); if (exact && !catTouched && exact.category_id) { cat.value = exact.category_id; sub.refill(); if (exact.subcategory_id) sub.value = exact.subcategory_id; if (!merchant.value && exact.merchant) merchant.value = exact.merchant; if (!pay.value && exact.payment_method) pay.value = exact.payment_method; } } catch (_) {} }, 200);
      desc.addEventListener('input', look);
      cpay.addEventListener('change', async () => { if (!cpay.value) return; const cs = await L.get('/fin/commitments'); for (const c of cs) { const p = c.payments.find(x => x.id === Number(cpay.value)); if (p) { if (!desc.value) desc.value = c.name; amount.value = L.minorToInput(p.remaining_minor || p.amount_minor); if (c.category_id) { cat.value = c.category_id; catTouched = true; sub.refill(); } if (c.account_id) account.value = c.account_id; } } });
    }
    const collect = () => {
      const p = { type, description: desc.value.trim(), amount: amount.value.trim(), category_id: cat.value ? Number(cat.value) : null, subcategory_id: sub.value ? Number(sub.value) : null, txn_date: date.value, txn_time: time.value || null, merchant: merchant.value.trim() || null,
        payment_method: pay.value.trim() || null, account_id: account.value ? Number(account.value) : null, recurring: recurring.checked ? 1 : 0, notes: notes.value.trim() || null, tags: tags.value };
      if (isExp) { p.essential = ess.value === '' ? null : Number(ess.value); p.commitment_payment_id = cpay.value ? Number(cpay.value) : null; } else { p.status = status.value; p.source = source.value.trim() || null; p.reference = reference.value.trim() || null; }
      return p;
    };
    const save = async (another, api) => {
      if (busy) return false; err.textContent = L.t('');
      const p = collect();
      if (!p.description) { err.textContent = L.t('Enter a description.'); desc.focus(); return false; }
      if (!p.amount || /^[0.,\s]+$/.test(p.amount)) { err.textContent = L.t('Enter an amount greater than zero (up to 2 decimals).'); amount.focus(); return false; }
      if (!p.category_id) { err.textContent = L.t('Choose a category.'); cat.focus(); return false; }
      if (!p.txn_date) { err.textContent = L.t('Choose a date.'); date.focus(); return false; }
      busy = true; api.el.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        let res;
        if (editing) { res = await L.put('/fin/transactions/' + id, p); L.toast('Changes saved'); }
        else { res = await L.submitTxn({ ...p, id }); const tr = res.transaction; L.toast(res.already_saved ? 'Already saved — no duplicate was created' : `${isExp ? 'Expense' : (tr.status === 'expected' ? 'Expected income' : 'Income')} saved: ${tr.description} ${L.money2(tr.amount_minor)}`); }
        if (isExp && !editing && p.category_id) { L.settings.last_expense_category = String(p.category_id); L.put('/settings', { last_expense_category: String(p.category_id) }).catch(() => {}); }
        onSaved && onSaved(res);
        if (another && !editing) { id = L.uuid(); desc.value = ''; amount.value = ''; notes.value = ''; tags.value = ''; reference.value = ''; cpay.value = ''; desc.focus(); L.refresh(); return false; }
        L.refresh(); return true;
      } catch (e) { if (!e.cancelled) err.textContent = L.t(e.message); return false; } finally { busy = false; api.el.querySelectorAll('button').forEach(b => b.disabled = false); }
    };
    const form = h('form', { novalidate: true, onsubmit: e => e.preventDefault(), onkeydown: e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); save(e.ctrlKey || e.metaKey, api).then(ok => ok && api.close()); } } },
      h('div', { class: 'fgrid' }, L.field(isExp ? 'What did you buy?' : 'Description', desc, { req: true, cls: 'wide' }), dl, L.field('Amount', amount, { req: true, hint: L.curSym() }), L.field('Category', cat, { req: true }), L.field('Date', date, { req: true }, ), !isExp ? L.field('Status', status) : null),
      err,
      h('details', { class: 'more', open: editing }, h('summary', {}, 'More details'),
        h('div', { class: 'fgrid' }, L.field('Subcategory', sub), isExp ? L.field('Merchant or vendor', merchant) : L.field('Source or payer', source), dlSrc, L.field('Time', time), L.field('Payment method', pay), dlPay, L.field('Account', account),
          isExp ? L.field('Classification', ess) : L.field('Reference number', reference), isExp ? L.field('Pay a commitment', cpay, { cls: 'wide' }) : null,
          h('label', { class: 'row', style: 'gap:6px;align-self:end' }, recurring, h('span', {}, 'Recurring')), L.field('Tags', tags), L.field('Notes', notes, { cls: 'wide' }))));
    const actions = [{ label: 'Cancel' }];
    if (!editing) actions.push({ label: L.t('Save and add another'), onClick: a => save(true, a).then(() => false), close: false });
    actions.push({ label: L.t('Save'), class: 'primary', onClick: a => save(false, a) });
    const api = L.modal({ title: title || (editing ? `Edit ${type}` : (isExp ? 'Add expense' : 'Add income')), body: form, actions, wide: false });
    return api;
  };
  L.openExpense = o => L.openTxnForm('expense', o); L.openIncome = o => L.openTxnForm('income', o);

  /** Compact always-visible quick entry (Expenses page, dashboard). Enter saves. */
  L.quickExpenseBar = function ({ date, onSaved } = {}) {
    let id = L.uuid(); let busy = false; const lastCat = L.settings.last_expense_category ? Number(L.settings.last_expense_category) : '';
    const desc = h('input', { placeholder: 'What did you buy?', maxlength: 200, 'aria-label': 'Description', list: 'dl-q', autocomplete: 'off' }); const dl = h('datalist', { id: 'dl-q' });
    const amt = h('input', { inputmode: 'decimal', placeholder: '0.00', 'aria-label': 'Amount', autocomplete: 'off' }); const cat = L.select(L.catOptions('expense'), lastCat, { 'aria-label': 'Category' }); let touched = !!lastCat;
    cat.addEventListener('change', () => touched = true); const dt = h('input', { type: 'date', value: date || L.today(), 'aria-label': 'Date' }); const err = h('div', { class: 'err', role: 'alert' });
    desc.addEventListener('input', L.debounce(async () => { const q = desc.value.trim(); if (q.length < 2) return; try { const s = await L.get('/fin/suggest?q=' + encodeURIComponent(q)); L.clear(dl); s.forEach(x => dl.append(h('option', { value: x.description }))); const ex = s.find(x => x.description.toLowerCase() === q.toLowerCase()); if (ex && !touched && ex.category_id) cat.value = ex.category_id; } catch (_) {} }, 200));
    const btn = h('button', { class: 'btn primary', type: 'button' }, L.t('Save'));
    const save = async () => {
      if (busy) return; err.textContent = L.t(''); const p = { type: 'expense', id, description: desc.value.trim(), amount: amt.value.trim(), category_id: cat.value ? Number(cat.value) : null, txn_date: dt.value };
      if (!p.description) { err.textContent = L.t('Enter what you bought.'); return desc.focus(); } if (!amt.value.trim()) { err.textContent = L.t('Enter the amount.'); return amt.focus(); } if (!p.category_id) { err.textContent = L.t('Choose a category.'); return cat.focus(); }
      busy = true; btn.disabled = true;
      try { const r = await L.submitTxn(p); L.toast(r.already_saved ? 'Already saved' : `Saved: ${r.transaction.description} ${L.money2(r.transaction.amount_minor)}`); L.settings.last_expense_category = String(p.category_id); L.put('/settings', { last_expense_category: String(p.category_id) }).catch(() => {}); id = L.uuid(); desc.value = ''; amt.value = ''; desc.focus(); onSaved ? onSaved(r) : L.refresh(); }
      catch (e) { if (!e.cancelled) err.textContent = L.t(e.message); } finally { busy = false; btn.disabled = false; }
    };
    btn.addEventListener('click', save);
    const onKey = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } };
    [desc, amt, cat, dt].forEach(x => x.addEventListener('keydown', onKey));
    const more = h('button', { class: 'btn ghost', type: 'button', onclick: () => L.openExpense({ defaults: { description: desc.value, amount: amt.value, category_id: cat.value || '', txn_date: dt.value } }) }, 'More details');
    return h('div', { class: 'card' }, h('div', { class: 'quick' }, L.field('What did you buy?', desc), dl, L.field('Amount', amt), L.field('Category', cat), L.field('Date', dt), h('div', { class: 'row' }, btn, more)), err);
  };

  L.openTransfer = function (defaults = {}) {
    const from = L.select(L.accountOptions('Choose account'), defaults.account_id || ''); const to = L.select(L.accountOptions('Choose account'), defaults.to_account_id || ''); const amount = h('input', { inputmode: 'decimal', placeholder: '0.00', value: defaults.amount || '' });
    const date = h('input', { type: 'date', value: L.today() }); const notes = h('input', { placeholder: 'Optional note', maxlength: 200 }); let id = L.uuid();
    const note = h('p', { class: 'small muted', style: 'margin:0 0 10px' }, 'Transfers move money between your own accounts (including paying a credit card or funding an investment account). They are not income or expenses.');
    if (L.accounts.filter(a => a.status === 'active').length < 2) return L.toast('Add at least two accounts first (Settings → Accounts).', 'warn');
    L.modal({ title: 'Transfer between accounts', body: h('div', {}, note, h('div', { class: 'fgrid' }, L.field('From', from, { req: true }), L.field('To', to, { req: true }), L.field('Amount', amount, { req: true }), L.field('Date', date, { req: true }), L.field('Note', notes, { cls: 'wide' }))), actions: [{ label: 'Cancel' },
      { label: 'Save transfer', class: 'primary', onClick: async () => { await L.post('/fin/transactions', { id, type: 'transfer', description: notes.value.trim() || L.t('Transfer'), amount: amount.value, txn_date: date.value, account_id: Number(from.value) || null, to_account_id: Number(to.value) || null }); L.toast('Transfer saved'); await bump(); } }] });
  };
  L.openAdjustment = function (account) {
    const acc = L.select(L.accountOptions('Choose account'), account ? account.id : ''); const dir = L.select([{ value: 'in', label: 'Increase balance' }, { value: 'out', label: 'Decrease balance' }], 'in'); const amount = h('input', { inputmode: 'decimal', placeholder: '0.00' }); const date = h('input', { type: 'date', value: L.today() }); const why = h('input', { placeholder: 'Reason (kept in the audit trail)', maxlength: 200 });
    L.modal({ title: 'Account adjustment', body: h('div', {}, h('p', { class: 'small muted', style: 'margin-top:0' }, 'Use this to correct a calculated balance. It is recorded as an adjustment, not as income or an expense.'), h('div', { class: 'fgrid' }, L.field('Account', acc, { req: true }), L.field('Direction', dir), L.field('Amount', amount, { req: true }), L.field('Date', date), L.field('Reason', why, { req: true, cls: 'wide' }))), actions: [{ label: 'Cancel' },
      { label: 'Save adjustment', class: 'primary', onClick: async () => { if (!why.value.trim()) throw new Error('Enter a reason for the adjustment.'); await L.post('/fin/transactions', { id: L.uuid(), type: 'adjustment', description: why.value.trim(), amount: amount.value, txn_date: date.value, account_id: Number(acc.value) || null, direction: dir.value }); L.toast('Adjustment saved'); await bump(); } }] });
  };
  L.openRefund = function (exp) {
    const refunded = exp.refunded_minor || 0; const max = exp.amount_minor - refunded; const amount = h('input', { inputmode: 'decimal', value: L.minorToInput(max) }); const date = h('input', { type: 'date', value: L.today() }); const notes = h('input', { placeholder: 'Optional note' });
    L.modal({ title: 'Record a refund', body: h('div', {}, h('p', { style: 'margin-top:0' }, h('b', {}, exp.description), ` · ${L.money2(exp.amount_minor)} on ${L.fmtDate(exp.txn_date)}`), h('p', { class: 'small muted' }, 'A refund reduces your net spending in its category. It is not counted as income.'), h('div', { class: 'fgrid' }, L.field('Refund amount', amount, { req: true, hint: `Up to ${L.money2(max)}` }), L.field('Date received', date, { req: true }), L.field('Note', notes, { cls: 'wide' }))), actions: [{ label: 'Cancel' },
      { label: 'Save refund', class: 'primary', onClick: async () => { await L.post('/fin/transactions', { id: L.uuid(), type: 'refund', description: L.t('Refund: ' + exp.description), refund_of: exp.id, amount: amount.value, txn_date: date.value, notes: notes.value.trim() || null, category_id: exp.category_id }); L.toast('Refund recorded'); await bump(); } }] });
  };
  L.openReceive = function (t) {
    const date = h('input', { type: 'date', value: L.today() }); const amount = h('input', { inputmode: 'decimal', value: L.minorToInput(t.amount_minor) });
    L.modal({ title: 'Mark income as received', body: h('div', {}, h('p', { style: 'margin-top:0' }, h('b', {}, t.description), ` · expected ${L.fmtDate(t.txn_date)}`), h('div', { class: 'fgrid' }, L.field('Date received', date, { req: true }), L.field('Amount received', amount, { req: true }))), actions: [{ label: 'Cancel' },
      { label: 'Mark as received', class: 'primary', onClick: async () => { await L.post(`/fin/transactions/${t.id}/receive`, { date: date.value, amount: amount.value }); L.toast('Income confirmed'); await bump(); } }] });
  };
})();
