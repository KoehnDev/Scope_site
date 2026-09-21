(() => {
  // Use the short Koehn label for Division 23 on the Proposal side.
  // Existing projects are only changed when they still use the untouched standard CSI label.
  const legacyHvacTitle = 'Heating, Ventilating, and Air Conditioning (HVAC)';
  const legacyHvacSummaryLabel = `23 - ${legacyHvacTitle}`;

  try {
    if (typeof CSI_DIVISIONS !== 'undefined') {
      const hvac = CSI_DIVISIONS.find(([number]) => number === '23');
      if (hvac) hvac[1] = 'HVAC';
    }
  } catch (error) {
    console.warn('Could not shorten the Division 23 Proposal label.', error);
  }

  const normalizeProposalHvacLabel = project => {
    if (!project) return project;
    const division = project.divisions?.['23'];
    if (division && (!String(division.title || '').trim() || String(division.title || '').trim() === legacyHvacTitle)) {
      division.title = 'HVAC';
    }
    const basic = project.summary?.basicDivisions?.['23'];
    if (basic && (!String(basic.label || '').trim() || String(basic.label || '').trim() === legacyHvacSummaryLabel)) {
      basic.label = '23 - HVAC';
    }
    return project;
  };

  if (typeof normalizeProject === 'function' && !normalizeProject.__proposalHvacShortLabelWrapped) {
    const originalNormalizeProject = normalizeProject;
    const wrappedNormalizeProject = function(project, ownerUsername = '') {
      return normalizeProposalHvacLabel(originalNormalizeProject.apply(this, arguments));
    };
    wrappedNormalizeProject.__proposalHvacShortLabelWrapped = true;
    normalizeProject = wrappedNormalizeProject;
    window.normalizeProject = wrappedNormalizeProject;
  }

  // The Kickoff financial block is inserted by a later-loaded patch, so update its heading
  // when it appears without changing any of the financial field behavior.
  const retitleKickoffFinancials = () => {
    const title = document.querySelector('.kickoff-financial-title');
    if (!title) return false;
    title.textContent = 'Project Financials';
    return true;
  };
  if (!retitleKickoffFinancials()) {
    const observer = new MutationObserver(() => {
      if (retitleKickoffFinancials()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();

(() => {
  // Match Kickoff PDF preview controls and rendering speed to Proposal.
  if (!document.querySelector('script[data-kickoff-preview-controls]')) {
    const script = document.createElement('script');
    script.src = 'kickoff-preview-controls.js?v=20260831-1';
    script.async = false;
    script.dataset.kickoffPreviewControls = 'true';
    script.onerror = () => console.error('Kickoff preview controls failed to load.');
    document.head.appendChild(script);
  }
})();

(() => {
  // Load currency auto-formatting for proposal and kickoff monetary fields.
  if (!document.querySelector('script[data-currency-autoformat]')) {
    const script = document.createElement('script');
    script.src = 'currency-autoformat.js?v=20260921-2';
    script.async = false;
    script.dataset.currencyAutoformat = 'true';
    script.onerror = () => console.error('Currency auto-formatting failed to load.');
    document.head.appendChild(script);
  }
})();

(() => {
  // Load nested quote page controls after the core kickoff functions.
  if (!document.querySelector('script[data-kickoff-quote-pages]')) {
    const script = document.createElement('script');
    script.src = 'kickoff-quote-pages.js?v=20260831-1';
    script.async = false;
    script.dataset.kickoffQuotePages = 'true';
    script.onerror = () => console.error('Kickoff quote page controls failed to load.');
    document.head.appendChild(script);
  }
})();

(() => {
  // Load the archive/import stability patch after the core app. The script only
  // overrides cloud merge + archive/import functions and leaves proposal data intact.
  if (!document.querySelector('script[data-archive-sync-fix]')) {
    const script = document.createElement('script');
    script.src = 'archive-sync-fix.js?v=20260828-1';
    script.async = false;
    script.dataset.archiveSyncFix = 'true';
    script.onerror = () => console.error('Archive sync stability patch failed to load.');
    document.head.appendChild(script);
  }
})();

(() => {
  // Revision 3 proposal styling patch.
  // Keeps the current Koehn proposal theme while separating the Alternates section
  // with a branded divider and a light gray alternate-card background.
  if (typeof exportPdf !== 'function') {
    console.warn('Alternate proposal theme patch skipped: exportPdf is unavailable.');
    return;
  }

  const originalExportPdf = exportPdf;
  let source = originalExportPdf.toString();
  let replacements = 0;

  const replaceOnce = (find, replacement, label) => {
    if (!source.includes(find)) {
      console.warn(`Alternate proposal theme patch could not find: ${label}`);
      return;
    }
    source = source.replace(find, replacement);
    replacements += 1;
  };

  replaceOnce(
`    (p.alternateScopes||[]).filter(a=>a.enabled!==false&&String(a.text||'').trim()).forEach((a,index)=>{
      const title=String(a.title||\`Alternate \${String(index+1).padStart(2,'0')}\`).trim().toUpperCase();
      addSplittable({type:'alternate',title},scopeItemsFromRichHtml(a.richText,a.text),{fontSize:minPdfFont,leading:bodyLeading,titleGap:.12});
    });`,
`    const enabledAlternates=(p.alternateScopes||[]).filter(a=>a.enabled!==false&&String(a.text||'').trim());
    if(enabledAlternates.length){
      const dividerH=.42;
      const firstAlternateItems=scopeItemsFromRichHtml(enabledAlternates[0].richText,enabledAlternates[0].text);
      const firstAlternateMinH=cardHeight(firstAlternateItems.slice(0,1),{fontSize:minPdfFont,leading:bodyLeading,titleGap:.12});
      const needed=dividerH+cardGap+firstAlternateMinH;
      if(current.length&&pageH-bottomLimit-y<needed){pages.push(current);current=[];y=topY;}
      current.push({type:'alternate-divider',height:dividerH});y+=dividerH+cardGap;
      enabledAlternates.forEach((a,index)=>{
        const title=String(a.title||\`Alternate \${String(index+1).padStart(2,'0')}\`).trim().toUpperCase();
        addSplittable({type:'alternate',title},scopeItemsFromRichHtml(a.richText,a.text),{fontSize:minPdfFont,leading:bodyLeading,titleGap:.12});
      });
    }`,
    'alternate layout block'
  );

  replaceOnce(
`  function drawCardBase(y,h){
    setFill(shadow);doc.roundedRect(contentX+.025,y+.025,contentW,h,.10,.10,'F');
    setFill([255,255,255]);doc.roundedRect(contentX,y,contentW,h,.10,.10,'F');
    setFill(orange);doc.triangle(contentX+.10,y+.10,contentX+.29,y+.10,contentX+.10,y+.29,'F');
  }`,
`  function drawCardBase(y,h,{fillColor=[255,255,255]}={}){
    setFill(shadow);doc.roundedRect(contentX+.025,y+.025,contentW,h,.10,.10,'F');
    setFill(fillColor);doc.roundedRect(contentX,y,contentW,h,.10,.10,'F');
    setFill(orange);doc.triangle(contentX+.10,y+.10,contentX+.29,y+.10,contentX+.10,y+.29,'F');
  }
  function drawAlternateDivider(y){
    const h=.42;
    setFill(shadow);doc.roundedRect(contentX+.018,y+.018,contentW,h,.08,.08,'F');
    setFill(charcoal);doc.roundedRect(contentX,y,contentW,h,.08,.08,'F');
    setFill(orange);doc.triangle(contentX+.10,y+.09,contentX+.29,y+.09,contentX+.10,y+.28,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);setText([255,255,255]);
    doc.text('ALTERNATES',contentX+.42,y+.275);
    return y+h+cardGap;
  }`,
    'card base and alternate divider'
  );

  replaceOnce(
`    const opts={fontSize:minPdfFont,leading:bodyLeading,titleGap};const h=cardHeight(entry.items,opts);drawCardBase(y,h);`,
`    const opts={fontSize:minPdfFont,leading:bodyLeading,titleGap};const h=cardHeight(entry.items,opts);drawCardBase(y,h,{fillColor:isAlternate?pale:[255,255,255]});`,
    'alternate card fill'
  );

  replaceOnce(
`    entries.forEach(entry=>{if(entry.type==='division')y=drawDivisionCard(entry,y);else if(entry.type==='simple'||entry.type==='alternate'||entry.type==='intro')y=drawSimpleCard(entry,y);else if(entry.type==='selections')y=drawSelections(y);else if(entry.type==='terms')y=drawTerms(y);else if(entry.type==='closing')drawClosing(y);});`,
`    entries.forEach(entry=>{if(entry.type==='division')y=drawDivisionCard(entry,y);else if(entry.type==='alternate-divider')y=drawAlternateDivider(y);else if(entry.type==='simple'||entry.type==='alternate'||entry.type==='intro')y=drawSimpleCard(entry,y);else if(entry.type==='selections')y=drawSelections(y);else if(entry.type==='terms')y=drawTerms(y);else if(entry.type==='closing')drawClosing(y);});`,
    'proposal render loop'
  );

  if (replacements !== 4) {
    console.warn(`Alternate proposal theme patch not applied. Expected 4 replacements; found ${replacements}.`);
    return;
  }

  try {
    const patchedExportPdf = eval(`(${source})`);
    exportPdf = patchedExportPdf;
    window.exportPdf = patchedExportPdf;

    // app.js attached the original function directly to this button, so clone the
    // button once to remove that old listener and attach the patched exporter.
    const oldButton = document.getElementById('exportPdfBtn');
    if (oldButton && oldButton.dataset.altThemePatched !== 'true') {
      const newButton = oldButton.cloneNode(true);
      newButton.dataset.altThemePatched = 'true';
      oldButton.replaceWith(newButton);
      newButton.addEventListener('click', patchedExportPdf);
    }

    // Rebuild an open preview so the new alternate styling shows immediately.
    if (typeof schedulePdfPreview === 'function' && state?.currentProjectId) {
      schedulePdfPreview(40);
    }
  } catch (error) {
    console.error('Alternate proposal theme patch failed.', error);
  }
})();

(() => {
  // Advanced Budget Summary PDF: only show the direct-cost total when the
  // Additional Costs / Section Subtotals area is actually being used.
  if (typeof exportPdf !== 'function') {
    console.warn('Advanced summary PDF cleanup skipped: exportPdf is unavailable.');
    return;
  }

  const currentExportPdf = exportPdf;
  let source = currentExportPdf.toString();
  const directTotalRow = `    rows.push({kind:'direct-total',label:'DIRECT COST TOTAL',amount:formatMoneyNumber(directTotal)});`;
  const conditionalDirectTotal = `    const usesAdditionalCostSection=(p.summary?.extraRows||[]).some(r=>r.type==='subtotal'||String(r.label||'').trim()||String(r.amount||'').trim());\n    if(usesAdditionalCostSection)rows.push({kind:'direct-total',label:'DIRECT COST TOTAL',amount:formatMoneyNumber(directTotal)});`;

  if (!source.includes(directTotalRow)) {
    console.warn('Advanced summary PDF cleanup could not find the direct-cost total row.');
    return;
  }

  source = source.replace(directTotalRow, conditionalDirectTotal);

  try {
    const patchedExportPdf = eval(`(${source})`);
    exportPdf = patchedExportPdf;
    window.exportPdf = patchedExportPdf;

    // Replace the existing export button once so its direct click listener points
    // at the final patched exporter rather than the prior Proposal theme function.
    const oldButton = document.getElementById('exportPdfBtn');
    if (oldButton && oldButton.dataset.advancedSummaryPdfPatched !== 'true') {
      const newButton = oldButton.cloneNode(true);
      newButton.dataset.advancedSummaryPdfPatched = 'true';
      oldButton.replaceWith(newButton);
      newButton.addEventListener('click', patchedExportPdf);
    }

    if (typeof schedulePdfPreview === 'function' && state?.currentProjectId) {
      schedulePdfPreview(40);
    }
  } catch (error) {
    console.error('Advanced summary PDF cleanup failed.', error);
  }
})();
