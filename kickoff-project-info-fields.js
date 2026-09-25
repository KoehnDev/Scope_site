(() => {
  // Kickoff-only project information additions. These fields do not touch Proposal data.
  if (typeof buildKickoffPdf !== 'function') {
    console.warn('Kickoff project info fields skipped: buildKickoffPdf is unavailable.');
    return;
  }

  const targetGpInput = document.querySelector('[data-kickoff-info="targetGP"]');
  const targetGpLabel = targetGpInput?.closest('label');

  if (targetGpLabel && !document.querySelector('[data-kickoff-info="revenue"]')) {
    targetGpLabel.classList.add('hidden');

    const financialBlock = document.createElement('div');
    financialBlock.className = 'full kickoff-financial-block';
    financialBlock.innerHTML = `
      <div class="kickoff-financial-title">Target GP</div>
      <div class="kickoff-financial-grid">
        <label>Revenue<input class="kickoff-financial-currency" data-kickoff-info="revenue" inputmode="decimal" placeholder="$0" /></label>
        <label>Project Cost<input class="kickoff-financial-currency" data-kickoff-info="projectCost" inputmode="decimal" placeholder="$0" /></label>
        <label>Gross Profit<input class="kickoff-financial-currency kickoff-gross-profit" data-kickoff-info="grossProfit" placeholder="$0" readonly aria-readonly="true" /></label>
      </div>`;
    targetGpLabel.insertAdjacentElement('afterend', financialBlock);
  }

  const financialBlock = document.querySelector('.kickoff-financial-block');
  if (financialBlock && !document.querySelector('[data-kickoff-info="contingencyPercent"]')) {
    const contingencyLabel = document.createElement('label');
    contingencyLabel.className = 'kickoff-contingency-field';
    contingencyLabel.innerHTML = 'Contingency %<input data-kickoff-info="contingencyPercent" inputmode="decimal" maxlength="5" placeholder="0" aria-label="Contingency percent" />';
    financialBlock.insertAdjacentElement('afterend', contingencyLabel);

    const permitLabel = document.createElement('label');
    permitLabel.className = 'full kickoff-permitting-field';
    permitLabel.innerHTML = 'Permitting, Permit Entity, Inspections &amp; Testing<textarea data-kickoff-info="permittingInspectionsTesting" rows="4" placeholder="Enter permitting requirements, inspections, testing, fees, responsibilities, or other related notes."></textarea>';
    contingencyLabel.insertAdjacentElement('afterend', permitLabel);
  }

  const taxLabel = document.querySelector('[data-kickoff-info="taxStatus"]')?.closest('label');
  const contingencyLabel = document.querySelector('.kickoff-contingency-field');
  if (taxLabel && contingencyLabel) taxLabel.insertAdjacentElement('afterend', contingencyLabel);
  if (contingencyLabel && !document.querySelector('[data-kickoff-info="contractRequirements"]')) {
    const requirementsLabel = document.createElement('label');
    requirementsLabel.className = 'full kickoff-contract-requirements-field';
    requirementsLabel.innerHTML = 'Liquidated Damages, Wage Requirements, BABA &amp; Allowances<textarea data-kickoff-info="contractRequirements" rows="4" placeholder="Enter liquidated damages, wage requirements, BABA requirements, and allowances."></textarea>';
    contingencyLabel.insertAdjacentElement('afterend', requirementsLabel);
  }

  const style = document.createElement('style');
  style.textContent = `
    .kickoff-financial-block{border:1px solid #d9dde1;border-radius:10px;background:#f8f9fa;padding:13px 14px 14px}
    .kickoff-financial-title{color:#555a60;font-size:12px;font-weight:800;margin-bottom:10px}
    .kickoff-financial-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .kickoff-financial-grid label{min-width:0}
    .kickoff-gross-profit{background:#f1f2f3;font-weight:700;color:#45494d}
    .kickoff-contingency-field input{max-width:76px;justify-self:start;text-align:right}
    .kickoff-permitting-field textarea,.kickoff-contract-requirements-field textarea{min-height:104px}
    @media (max-width:760px){.kickoff-financial-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const revenueInput = document.querySelector('[data-kickoff-info="revenue"]');
  const projectCostInput = document.querySelector('[data-kickoff-info="projectCost"]');
  const grossProfitInput = document.querySelector('[data-kickoff-info="grossProfit"]');
  const contingencyInput = document.querySelector('[data-kickoff-info="contingencyPercent"]');
  const permittingInput = document.querySelector('[data-kickoff-info="permittingInspectionsTesting"]');

  const requirementsInput = document.querySelector('[data-kickoff-info="contractRequirements"]');

  function moneyValue(value) {
    const raw = String(value ?? '').trim();
    if (!raw || !/\d/.test(raw)) return NaN;
    const negative = /^\s*-/.test(raw) || /^\(.*\)$/.test(raw);
    const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : NaN;
  }

  function liveDollarPrefix(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.includes('$')) return raw;
    if (raw.startsWith('-')) return `-$${raw.slice(1)}`;
    return `$${raw}`;
  }

  function formatCurrency(value) {
    if (typeof window.formatKoehnCurrencyValue === 'function') return window.formatKoehnCurrencyValue(value);
    const amount = moneyValue(value);
    if (!Number.isFinite(amount)) return String(value ?? '');
    return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(amount);
  }

  function recalcGrossProfit({save=false}={}) {
    if (!grossProfitInput) return;
    const revenue = moneyValue(revenueInput?.value);
    const cost = moneyValue(projectCostInput?.value);
    let next = grossProfitInput.value || '';
    if (Number.isFinite(revenue) && Number.isFinite(cost)) next = formatCurrency(revenue - cost);
    else if (!Number.isFinite(revenue) || !Number.isFinite(cost)) next = '';
    if (grossProfitInput.value !== next) grossProfitInput.value = next;
    if (save && typeof scheduleKickoffSave === 'function') scheduleKickoffSave();
  }

  [revenueInput, projectCostInput].filter(Boolean).forEach(input => {
    if (input.dataset.kickoffFinancialWired === 'true') return;
    input.dataset.kickoffFinancialWired = 'true';
    input.addEventListener('input', () => {
      const next = liveDollarPrefix(input.value);
      if (next !== input.value) {
        const atEnd = input.selectionStart === input.value.length;
        input.value = next;
        if (atEnd) { try { input.setSelectionRange(next.length, next.length); } catch {} }
      }
      recalcGrossProfit({save:true});
    });
    input.addEventListener('focusout', () => {
      const next = formatCurrency(input.value);
      if (next !== input.value) input.value = next;
      recalcGrossProfit({save:true});
    });
    input.addEventListener('change', () => {
      recalcGrossProfit({save:true});
      if (typeof saveKickoffInfoFromForm === 'function') saveKickoffInfoFromForm();
      if (typeof scheduleKickoffPdfPreview === 'function') scheduleKickoffPdfPreview(120);
    });
  });

  function sanitizeContingencyPercent(value) {
    let raw = String(value ?? '').replace(/[^0-9.]/g, '');
    if (!raw) return '';
    const dot = raw.indexOf('.');
    if (dot < 0) return raw.slice(0, 2);
    let whole = raw.slice(0, dot).slice(0, 2);
    const decimals = raw.slice(dot + 1).replace(/\./g, '').slice(0, 2);
    if (!whole) whole = '0';
    return `${whole}.${decimals}`;
  }

  if (contingencyInput && contingencyInput.dataset.kickoffExtraWired !== 'true') {
    contingencyInput.dataset.kickoffExtraWired = 'true';
    contingencyInput.addEventListener('input', () => {
      const cleaned = sanitizeContingencyPercent(contingencyInput.value);
      if (contingencyInput.value !== cleaned) contingencyInput.value = cleaned;
      if (typeof scheduleKickoffSave === 'function') scheduleKickoffSave();
    });
    contingencyInput.addEventListener('change', () => {
      const cleaned = sanitizeContingencyPercent(contingencyInput.value).replace(/\.$/, '');
      if (contingencyInput.value !== cleaned) contingencyInput.value = cleaned;
      if (typeof saveKickoffInfoFromForm === 'function') saveKickoffInfoFromForm();
      if (typeof scheduleKickoffPdfPreview === 'function') scheduleKickoffPdfPreview(120);
    });
  }

  [permittingInput, requirementsInput].filter(Boolean).forEach(input => {
    if (input.dataset.kickoffExtraWired === 'true') return;
    input.dataset.kickoffExtraWired = 'true';
    input.addEventListener('input', () => {
      if (typeof scheduleKickoffSave === 'function') scheduleKickoffSave();
    });
    input.addEventListener('change', () => {
      if (typeof saveKickoffInfoFromForm === 'function') saveKickoffInfoFromForm();
      if (typeof scheduleKickoffPdfPreview === 'function') scheduleKickoffPdfPreview(120);
    });
  });

  function hydrateKickoffFinancialFields(project) {
    const info = project?.kickoff?.projectInfo || {};
    if (revenueInput) revenueInput.value = info.revenue || info.contractValue || '';
    if (projectCostInput) projectCostInput.value = info.projectCost || '';
    if (grossProfitInput) grossProfitInput.value = info.grossProfit || '';
    if (contingencyInput) contingencyInput.value = sanitizeContingencyPercent(info.contingencyPercent).replace(/\.$/, '');
    if (permittingInput) permittingInput.value = info.permittingInspectionsTesting || '';
    if (requirementsInput) requirementsInput.value = info.contractRequirements || '';
    recalcGrossProfit();
  }

  try {
    hydrateKickoffFinancialFields(typeof getCurrentKickoffProject === 'function' ? getCurrentKickoffProject() : null);
  } catch {}

  if (typeof populateKickoffBuilder === 'function' && !populateKickoffBuilder.__kickoffFinancialWrapped) {
    const originalPopulateKickoffBuilder = populateKickoffBuilder;
    const wrappedPopulateKickoffBuilder = function(project) {
      const result = originalPopulateKickoffBuilder.apply(this, arguments);
      try { hydrateKickoffFinancialFields(project); } catch {}
      return result;
    };
    wrappedPopulateKickoffBuilder.__kickoffFinancialWrapped = true;
    populateKickoffBuilder = wrappedPopulateKickoffBuilder;
    window.populateKickoffBuilder = wrappedPopulateKickoffBuilder;
  }

  function shouldShortenHvacDescription(division) {
    const number = String(division?.number || division?.sourceDivisionNumber || '').trim();
    const description = String(division?.description || '').trim();
    if (number !== '23') return false;
    return !description || /^Heating,\s*Ventilating.*Air Conditioning/i.test(description) || /^Heating.*\(HVAC\)$/i.test(description);
  }

  function normalizeKickoffHvacDivision() {
    const project = typeof getCurrentKickoffProject === 'function' ? getCurrentKickoffProject() : null;
    const divisions = project?.kickoff?.divisions || [];
    if (!divisions.some(shouldShortenHvacDescription)) return;
    if (typeof mutateKickoff === 'function') {
      mutateKickoff(k => {
        (k.divisions || []).forEach(d => { if (shouldShortenHvacDescription(d)) d.description = 'HVAC'; });
      });
    } else {
      divisions.forEach(d => { if (shouldShortenHvacDescription(d)) d.description = 'HVAC'; });
    }
  }

  if (typeof renderKickoffDivisions === 'function' && !renderKickoffDivisions.__hvacShortNameWrapped) {
    const originalRenderKickoffDivisions = renderKickoffDivisions;
    const wrappedRenderKickoffDivisions = function() {
      try { normalizeKickoffHvacDivision(); } catch {}
      return originalRenderKickoffDivisions.apply(this, arguments);
    };
    wrappedRenderKickoffDivisions.__hvacShortNameWrapped = true;
    renderKickoffDivisions = wrappedRenderKickoffDivisions;
    window.renderKickoffDivisions = wrappedRenderKickoffDivisions;
  }

  // Carry the fields into the Kickoff PDF only.
  let source = buildKickoffPdf.toString();
  let replacements = 0;

  const replaceOnce = (find, replacement, label) => {
    if (!source.includes(find)) {
      console.warn(`Kickoff project info PDF patch could not find: ${label}`);
      return;
    }
    source = source.replace(find, replacement);
    replacements += 1;
  };

  const oldSummaryRow = "[['Target GP',info.targetGP],['Preliminary Schedule',`${info.startDate?fmtDate(info.startDate):'—'} – ${info.endDate?fmtDate(info.endDate):'—'}`]]";
  const newSummaryRows = "[['Revenue',info.revenue||info.contractValue||''],['Project Cost',info.projectCost||'']],[['Gross Profit',String(info.projectCost||'').trim()?formatMoneyNumber(moneyNumber(info.revenue||info.contractValue||'')-moneyNumber(info.projectCost||'')):(info.grossProfit||'')],['Contingency %',String(info.contingencyPercent||'').trim()?sanitizeContingencyPercent(info.contingencyPercent).replace(/\\.$/,'')+'%':'']],[['Start Date',info.startDate?fmtDate(info.startDate):'—'],['End Date',info.endDate?fmtDate(info.endDate):'—']]";
  replaceOnce(oldSummaryRow, newSummaryRows, 'target GP financial rows');

  replaceOnce(
    "  y=drawSection(y,'Owner Contacts',info.ownerContacts||'');",
    "  if(String(info.permittingInspectionsTesting||'').trim())y=drawSection(y,'Permitting, Permit Entity, Inspections & Testing',info.permittingInspectionsTesting||'');\n  y=drawSection(y,'Owner Contacts',info.ownerContacts||'');",
    'permitting section placement'
  );

  if (replacements === 2) {
    try {
      const patchedBuildKickoffPdf = eval(`(${source})`);
      buildKickoffPdf = patchedBuildKickoffPdf;
      window.buildKickoffPdf = patchedBuildKickoffPdf;
      if (typeof scheduleKickoffPdfPreview === 'function' && typeof state !== 'undefined' && state.currentKickoffProjectId) {
        scheduleKickoffPdfPreview(80);
      }
    } catch (error) {
      console.error('Kickoff project info PDF patch failed.', error);
    }
  } else {
    console.warn(`Kickoff project info PDF patch not applied. Expected 2 replacements; found ${replacements}.`);
  }
})();
