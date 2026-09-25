(() => {
  // Kickoff-only cleanup: remove the redundant Contract Value field from the screen,
  // keep the Project Financials heading, and compact the kickoff PDF financial layout.
  let uiObserver = null;

  const syncKickoffFinancialUi = () => {
    const contractInput = document.querySelector('[data-kickoff-info="contractValue"]');
    const contractLabel = contractInput?.closest('label');
    if (contractLabel) contractLabel.remove();

    const title = document.querySelector('.kickoff-financial-title');
    if (title && title.textContent !== 'Project Financials') title.textContent = 'Project Financials';

    if (!document.querySelector('[data-kickoff-info="contractValue"]') && title && uiObserver) {
      uiObserver.disconnect();
      uiObserver = null;
    }
  };

  syncKickoffFinancialUi();
  if (!document.querySelector('.kickoff-financial-title')) {
    uiObserver = new MutationObserver(syncKickoffFinancialUi);
    uiObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

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

  let attempts = 0;
  const maxAttempts = 60;

  function patchKickoffPdfLayout() {
    attempts += 1;
    if (typeof buildKickoffPdf !== 'function') {
      if (attempts < maxAttempts) setTimeout(patchKickoffPdfLayout, 100);
      return;
    }

    let source = buildKickoffPdf.toString();
    if (source.includes('kickoff-financial-pdf-nested-window')) return;

    // Wait until the existing Project Financials patch has added Revenue / Project Cost / Gross Profit.
    if (!source.includes("['Revenue'") || !source.includes("['Project Cost'") || !source.includes("['Gross Profit'")) {
      if (attempts < maxAttempts) setTimeout(patchKickoffPdfLayout, 100);
      return;
    }

    const pageStartAnchor = "  let y=newPage('PROJECT KICKOFF'";
    const anchorIndex = source.indexOf(pageStartAnchor);
    if (anchorIndex < 0) {
      console.warn('Kickoff financial PDF layout patch could not find the kickoff page start.');
      return;
    }

    const financialBoxHelper = `  /* kickoff-financial-pdf-nested-window */\n  function drawProjectFinancialsBox(y,row){\n    const outerPad=.14;\n    const titleH=.28;\n    const gap=.10;\n    const innerW=(contentW-outerPad*2-gap*2)/3;\n    const innerH=.62;\n    const outerH=outerPad+titleH+innerH+outerPad;\n    y=ensureSpace(y,outerH+.12);\n\n    // Keep the outer window white so it matches the other kickoff PDF windows.\n    doc.setFillColor(255,255,255);doc.setDrawColor(...border);doc.setLineWidth(.008);\n    doc.roundedRect(contentX,y,contentW,outerH,.08,.08,'FD');\n    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...orange);\n    doc.text('PROJECT FINANCIALS',contentX+outerPad,y+.23);\n\n    row.forEach((item,idx)=>{\n      const x=contentX+outerPad+idx*(innerW+gap);\n      const innerY=y+outerPad+titleH;\n      const value=String(item?.[1]||'—');\n      doc.setFillColor(255,255,255);doc.setDrawColor(...border);doc.setLineWidth(.008);\n      doc.roundedRect(x,innerY,innerW,innerH,.07,.07,'FD');\n      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...text);\n      doc.text(String(item?.[0]||'').toUpperCase(),x+.12,innerY+.20);\n      doc.setFont('helvetica','normal');doc.setFontSize(12);doc.setTextColor(...text);\n      const lines=doc.splitTextToSize(value,innerW-.24);\n      doc.text(lines,x+.12,innerY+.44,{lineHeightFactor:1.12});\n    });\n    return y+outerH+.11;\n  }\n`;

    source = source.slice(0, anchorIndex) + financialBoxHelper + source.slice(anchorIndex);

    const summaryPattern = /  y=drawTwoColumnRows\(y,\[\[\['Owner \/ Client',info\.owner\|\|p\.clientName\],[\s\S]*?\]\]\);\n/;
    if (!summaryPattern.test(source)) {
      console.warn('Kickoff financial PDF layout patch could not find the project summary rows.');
      return;
    }

    const contingencyValue = "String(info.contingencyPercent||'').trim()?sanitizeContingencyPercent(info.contingencyPercent).replace(/\\.$/,'')+'%':''";
    const grossProfitValue = "String(info.projectCost||'').trim()?formatMoneyNumber(moneyNumber(info.revenue||info.contractValue||'')-moneyNumber(info.projectCost||'')):(info.grossProfit||'')";
    const summaryReplacement =
      "  y=drawTwoColumnRows(y,[[['Owner / Client',info.owner||p.clientName],['Contract Type',info.contractType]],[['Tax Status',info.taxStatus],['Contingency %'," + contingencyValue + "]]]);\n" +
      "  if(String(info.contractRequirements||'').trim())y=drawSection(y,'Liqudated damages, wage requirements, BABA, Allowances',info.contractRequirements);\n" +
      "  y=drawProjectFinancialsBox(y,[['Revenue',info.revenue||info.contractValue||''],['Project Cost',info.projectCost||''],['Gross Profit'," + grossProfitValue + "]]);\n" +
      "  y=drawTwoColumnRows(y,[[['Start Date',info.startDate?fmtDate(info.startDate):'—'],['End Date',info.endDate?fmtDate(info.endDate):'—']]]);\n";

    source = source.replace(summaryPattern, summaryReplacement);

    try {
      const patchedBuildKickoffPdf = eval(`(${source})`);
      buildKickoffPdf = patchedBuildKickoffPdf;
      window.buildKickoffPdf = patchedBuildKickoffPdf;
      if (typeof scheduleKickoffPdfPreview === 'function' && typeof state !== 'undefined' && state.currentKickoffProjectId) {
        scheduleKickoffPdfPreview(80);
      }
    } catch (error) {
      console.error('Kickoff financial PDF layout patch failed.', error);
    }
  }

  patchKickoffPdfLayout();
})();
