(() => {
  // Kickoff-only project information additions. These fields do not touch Proposal data.
  if (typeof buildKickoffPdf !== 'function') {
    console.warn('Kickoff project info fields skipped: buildKickoffPdf is unavailable.');
    return;
  }

  const targetGpInput = document.querySelector('[data-kickoff-info="targetGP"]');
  const targetGpLabel = targetGpInput?.closest('label');
  const kickoffFormCard = document.querySelector('#kickoffInfoTab .kickoff-form-card');
  const projectOverviewLabel = document.querySelector('[data-kickoff-info="projectOverview"]')?.closest('label');

  let gcProjectHeader = document.querySelector('.kickoff-gc-project-header');
  if (!gcProjectHeader) {
    gcProjectHeader = document.createElement('div');
    gcProjectHeader.className = 'kickoff-project-section-header kickoff-gc-project-header';
    gcProjectHeader.textContent = 'General Contractor Project';
  }

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

  let selfPerformToggleRow = document.querySelector('.kickoff-self-perform-toggle-row');
  let selfPerformSection = document.querySelector('#kickoffSelfPerformSection');
  if (financialBlock && !selfPerformToggleRow) {
    selfPerformToggleRow = document.createElement('div');
    selfPerformToggleRow.className = 'full kickoff-self-perform-toggle-row';
    selfPerformToggleRow.innerHTML = `
      <div class="kickoff-self-perform-toggle-copy">
        <strong>Self Perform Project Information</strong>
        <span>Include separate self-perform contingency and financial information in the kickoff.</span>
      </div>
      <label class="switch-label"><input id="kickoffSelfPerformEnabled" type="checkbox"><span class="switch"></span>Include</label>`;
    financialBlock.insertAdjacentElement('afterend', selfPerformToggleRow);

    selfPerformSection = document.createElement('div');
    selfPerformSection.id = 'kickoffSelfPerformSection';
    selfPerformSection.className = 'full kickoff-project-financial-section kickoff-self-perform-section hidden';
    selfPerformSection.innerHTML = `
      <div class="kickoff-project-section-header kickoff-self-perform-header">Self Perform Project</div>
      <label class="kickoff-self-contingency-field">Contingency %<input data-kickoff-info="selfPerformContingencyPercent" inputmode="decimal" maxlength="5" placeholder="0" aria-label="Self perform contingency percent" /></label>
      <div class="kickoff-financial-block kickoff-self-perform-financial-block">
        <div class="kickoff-financial-title">Project Financials</div>
        <div class="kickoff-financial-grid">
          <label>Revenue<input class="kickoff-financial-currency" data-kickoff-info="selfPerformRevenue" inputmode="decimal" placeholder="$0" /></label>
          <label>Project Cost<input class="kickoff-financial-currency" data-kickoff-info="selfPerformProjectCost" inputmode="decimal" placeholder="$0" /></label>
          <label>Gross Profit<input class="kickoff-financial-currency kickoff-gross-profit" data-kickoff-info="selfPerformGrossProfit" placeholder="$0" readonly aria-readonly="true" /></label>
        </div>
      </div>`;
    selfPerformToggleRow.insertAdjacentElement('afterend', selfPerformSection);
  }

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

  let projectDetailsSection = document.querySelector('#kickoffProjectDetailsSection');
  if (!projectDetailsSection) {
    projectDetailsSection = document.createElement('div');
    projectDetailsSection.id = 'kickoffProjectDetailsSection';
    projectDetailsSection.className = 'full kickoff-project-details-section';
    projectDetailsSection.innerHTML = `
      <div class="kickoff-project-details-title">Project Details</div>
      <div class="kickoff-project-details-grid"></div>`;
  }

  let projectFinancialHeader = document.querySelector('.kickoff-project-financial-header');
  if (!projectFinancialHeader) {
    projectFinancialHeader = document.createElement('div');
    projectFinancialHeader.className = 'full kickoff-project-section-header kickoff-project-financial-header';
    projectFinancialHeader.textContent = 'Project Financial Information';
  }

  let gcSection = document.querySelector('#kickoffGcProjectSection');
  if (!gcSection && financialBlock && contingencyLabel) {
    gcSection = document.createElement('div');
    gcSection.id = 'kickoffGcProjectSection';
    gcSection.className = 'full kickoff-project-financial-section kickoff-gc-section';
    gcSection.appendChild(gcProjectHeader);
    contingencyLabel.classList.add('kickoff-project-contingency-field');
    financialBlock.classList.add('kickoff-project-financial-inner');
    gcSection.appendChild(contingencyLabel);
    gcSection.appendChild(financialBlock);
  }

  const selfPerformContingencyLabel = document.querySelector('.kickoff-self-contingency-field');
  if (selfPerformContingencyLabel) selfPerformContingencyLabel.classList.add('kickoff-project-contingency-field');
  const selfPerformFinancialBlock = document.querySelector('.kickoff-self-perform-financial-block');
  if (selfPerformFinancialBlock) selfPerformFinancialBlock.classList.add('kickoff-project-financial-inner');

  function arrangeKickoffProjectInfoFields() {
    const form = kickoffFormCard || document.querySelector('#kickoffInfoTab .kickoff-form-card');
    if (!form) return;
    const fieldLabel = name => document.querySelector(`[data-kickoff-info="${name}"]`)?.closest('label');
    const mapsBlock = document.querySelector('.kickoff-map-options');
    const detailsGrid = projectDetailsSection?.querySelector('.kickoff-project-details-grid');

    [
      fieldLabel('owner'),
      fieldLabel('contractType'),
      fieldLabel('taxStatus'),
      fieldLabel('startDate'),
      fieldLabel('endDate'),
      fieldLabel('projectLocation')
    ].filter(Boolean).forEach(node => detailsGrid?.appendChild(node));

    const ordered = [
      fieldLabel('projectOverview'),
      projectDetailsSection,
      mapsBlock,
      document.querySelector('.kickoff-contract-requirements-field'),
      document.querySelector('.kickoff-permitting-field'),
      fieldLabel('ownerContacts'),
      fieldLabel('designTeam'),
      projectFinancialHeader,
      gcSection,
      selfPerformToggleRow,
      selfPerformSection,
      targetGpLabel
    ];
    ordered.filter(Boolean).forEach(node => form.appendChild(node));
  }
  arrangeKickoffProjectInfoFields();

  const style = document.createElement('style');
  style.textContent = `
    .kickoff-financial-block{border:1px solid #d9dde1;border-radius:10px;background:#f8f9fa;padding:13px 14px 14px}
    .kickoff-financial-title{color:#555a60;font-size:12px;font-weight:800;margin-bottom:10px}
    .kickoff-financial-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .kickoff-financial-grid label{min-width:0}
    .kickoff-gross-profit{background:#f1f2f3;font-weight:700;color:#45494d}
    .kickoff-permitting-field textarea,.kickoff-contract-requirements-field textarea{min-height:104px}
    .kickoff-project-section-header{grid-column:1/-1;margin:4px 0 -2px;padding:4px 0 7px;border-bottom:1px solid #d9dde1;color:#555a60;font-size:13px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}
    .kickoff-project-details-section{border:1px solid #d9dde1;border-radius:10px;background:#fff;padding:13px 14px 14px}
    .kickoff-project-details-title{color:#555a60;font-size:12px;font-weight:900;margin-bottom:10px;text-transform:uppercase}
    .kickoff-project-details-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .kickoff-project-details-grid>label{min-width:0;margin:0}
    .kickoff-project-details-grid>label.full{grid-column:auto}
    .kickoff-project-details-grid textarea{min-height:42px}
    .kickoff-project-financial-header{margin-top:8px}
    .kickoff-project-financial-section{display:grid;grid-template-columns:minmax(150px,.34fr) minmax(0,1fr);gap:12px;border:1px solid #d9dde1;border-radius:10px;background:#fff;padding:14px}
    .kickoff-project-financial-section.hidden{display:none}
    .kickoff-project-financial-section .kickoff-project-section-header{grid-column:1/-1;margin:0 0 2px;padding-top:0}
    .kickoff-project-contingency-field{grid-column:1/2;align-self:start}
    .kickoff-project-contingency-field input{max-width:90px;justify-self:start;text-align:right}
    .kickoff-project-financial-inner{grid-column:2/3}
    .kickoff-self-perform-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid #d9dde1;border-radius:10px;background:#fff;padding:12px 14px}
    .kickoff-self-perform-toggle-copy{display:flex;flex-direction:column;gap:2px}
    .kickoff-self-perform-toggle-copy strong{color:#555a60;font-size:12px}
    .kickoff-self-perform-toggle-copy span{color:#8a8e92;font-size:10px;line-height:1.35}
    @media (max-width:900px){.kickoff-project-details-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media (max-width:760px){
      .kickoff-financial-grid,.kickoff-project-details-grid{grid-template-columns:1fr}
      .kickoff-project-financial-section{grid-template-columns:1fr}
      .kickoff-project-contingency-field,.kickoff-project-financial-inner{grid-column:1/-1}
    }
  `;
  document.head.appendChild(style);

  const revenueInput = document.querySelector('[data-kickoff-info="revenue"]');
  const projectCostInput = document.querySelector('[data-kickoff-info="projectCost"]');
  const grossProfitInput = document.querySelector('[data-kickoff-info="grossProfit"]');
  const contingencyInput = document.querySelector('[data-kickoff-info="contingencyPercent"]');
  const permittingInput = document.querySelector('[data-kickoff-info="permittingInspectionsTesting"]');

  const requirementsInput = document.querySelector('[data-kickoff-info="contractRequirements"]');
  const selfPerformToggle = document.querySelector('#kickoffSelfPerformEnabled');
  const selfPerformContingencyInput = document.querySelector('[data-kickoff-info="selfPerformContingencyPercent"]');
  const selfPerformRevenueInput = document.querySelector('[data-kickoff-info="selfPerformRevenue"]');
  const selfPerformProjectCostInput = document.querySelector('[data-kickoff-info="selfPerformProjectCost"]');
  const selfPerformGrossProfitInput = document.querySelector('[data-kickoff-info="selfPerformGrossProfit"]');

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

  function recalcSelfPerformGrossProfit({save=false}={}) {
    if (!selfPerformGrossProfitInput) return;
    const revenue = moneyValue(selfPerformRevenueInput?.value);
    const cost = moneyValue(selfPerformProjectCostInput?.value);
    let next = selfPerformGrossProfitInput.value || '';
    if (Number.isFinite(revenue) && Number.isFinite(cost)) next = formatCurrency(revenue - cost);
    else next = '';
    if (selfPerformGrossProfitInput.value !== next) selfPerformGrossProfitInput.value = next;
    if (save && typeof scheduleKickoffSave === 'function') scheduleKickoffSave();
  }

  [selfPerformRevenueInput, selfPerformProjectCostInput].filter(Boolean).forEach(input => {
    if (input.dataset.kickoffFinancialWired === 'true') return;
    input.dataset.kickoffFinancialWired = 'true';
    input.addEventListener('input', () => {
      const next = liveDollarPrefix(input.value);
      if (next !== input.value) {
        const atEnd = input.selectionStart === input.value.length;
        input.value = next;
        if (atEnd) { try { input.setSelectionRange(next.length, next.length); } catch {} }
      }
      recalcSelfPerformGrossProfit({save:true});
    });
    input.addEventListener('focusout', () => {
      const next = formatCurrency(input.value);
      if (next !== input.value) input.value = next;
      recalcSelfPerformGrossProfit({save:true});
    });
    input.addEventListener('change', () => {
      recalcSelfPerformGrossProfit({save:true});
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

  [contingencyInput, selfPerformContingencyInput].filter(Boolean).forEach(input => {
    if (input.dataset.kickoffExtraWired === 'true') return;
    input.dataset.kickoffExtraWired = 'true';
    input.addEventListener('input', () => {
      const cleaned = sanitizeContingencyPercent(input.value);
      if (input.value !== cleaned) input.value = cleaned;
      if (typeof scheduleKickoffSave === 'function') scheduleKickoffSave();
    });
    input.addEventListener('change', () => {
      const cleaned = sanitizeContingencyPercent(input.value).replace(/\.$/, '');
      if (input.value !== cleaned) input.value = cleaned;
      if (typeof saveKickoffInfoFromForm === 'function') saveKickoffInfoFromForm();
      if (typeof scheduleKickoffPdfPreview === 'function') scheduleKickoffPdfPreview(120);
    });
  });

  function syncSelfPerformVisibility() {
    const enabled = Boolean(selfPerformToggle?.checked);
    selfPerformSection?.classList.toggle('hidden', !enabled);
  }

  if (selfPerformToggle && selfPerformToggle.dataset.kickoffSelfPerformWired !== 'true') {
    selfPerformToggle.dataset.kickoffSelfPerformWired = 'true';
    selfPerformToggle.addEventListener('change', () => {
      syncSelfPerformVisibility();
      if (typeof mutateKickoff === 'function') {
        mutateKickoff(k => {
          k.projectInfo = k.projectInfo || {};
          k.projectInfo.selfPerformEnabled = Boolean(selfPerformToggle.checked);
        });
      }
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
    if (selfPerformToggle) selfPerformToggle.checked = Boolean(info.selfPerformEnabled);
    if (selfPerformContingencyInput) selfPerformContingencyInput.value = sanitizeContingencyPercent(info.selfPerformContingencyPercent).replace(/\.$/, '');
    if (selfPerformRevenueInput) selfPerformRevenueInput.value = info.selfPerformRevenue || '';
    if (selfPerformProjectCostInput) selfPerformProjectCostInput.value = info.selfPerformProjectCost || '';
    if (selfPerformGrossProfitInput) selfPerformGrossProfitInput.value = info.selfPerformGrossProfit || '';
    recalcGrossProfit();
    recalcSelfPerformGrossProfit();
    syncSelfPerformVisibility();
    arrangeKickoffProjectInfoFields();
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
