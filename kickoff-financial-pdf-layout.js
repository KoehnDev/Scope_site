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

    const financialBoxHelper = `  /* kickoff-financial-pdf-nested-window */\n  function drawKickoffSectionLabel(y,label){\n    y=ensureSpace(y,.34);\n    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...charcoal);\n    doc.text(String(label||'').toUpperCase(),contentX,y+.13);\n    doc.setDrawColor(...border);doc.setLineWidth(.008);doc.line(contentX,y+.24,contentX+contentW,y+.24);\n    return y+.34;\n  }\n  function drawProjectDetailsBox(y,items){\n    const pad=.14,gap=.08,titleH=.28,cols=3;\n    const cellW=(contentW-pad*2-gap*(cols-1))/cols;\n    const rows=[];\n    for(let i=0;i<items.length;i+=cols)rows.push(items.slice(i,i+cols));\n    const rowHeights=rows.map(row=>{\n      doc.setFont('helvetica','normal');doc.setFontSize(10.5);\n      return Math.max(...row.map(item=>{const lines=doc.splitTextToSize(String(item?.[1]||'—'),cellW-.22);return Math.max(.58,.31+lines.length*.17);}),.58);\n    });\n    const outerH=pad+titleH+rowHeights.reduce((a,b)=>a+b,0)+gap*Math.max(0,rows.length-1)+pad;\n    y=ensureSpace(y,outerH+.12);\n    doc.setFillColor(255,255,255);doc.setDrawColor(...border);doc.setLineWidth(.008);\n    doc.roundedRect(contentX,y,contentW,outerH,.08,.08,'FD');\n    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...orange);\n    doc.text('PROJECT DETAILS',contentX+pad,y+.23);\n    let rowY=y+pad+titleH;\n    rows.forEach((row,rIdx)=>{\n      const h=rowHeights[rIdx];\n      row.forEach((item,cIdx)=>{\n        const x=contentX+pad+cIdx*(cellW+gap);\n        doc.setFillColor(...light);doc.setDrawColor(...border);doc.roundedRect(x,rowY,cellW,h,.06,.06,'FD');\n        doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...text);\n        doc.text(String(item?.[0]||'').toUpperCase(),x+.11,rowY+.18);\n        doc.setFont('helvetica','normal');doc.setFontSize(10.5);doc.setTextColor(...text);\n        const lines=doc.splitTextToSize(String(item?.[1]||'—'),cellW-.22);\n        doc.text(lines,x+.11,rowY+.39,{lineHeightFactor:1.12});\n      });\n      rowY+=h+gap;\n    });\n    return y+outerH+.11;\n  }\n  function drawProjectFinancialSection(y,title,contingency,row){\n    const pad=.14,gap=.08,titleH=.27,groupH=.18,cellH=.58;\n    const contingencyW=1.34;\n    const financialW=contentW-pad*2-contingencyW-gap;\n    const finCellW=(financialW-gap*2)/3;\n    const outerH=pad+titleH+groupH+cellH+pad;\n    y=ensureSpace(y,outerH+.12);\n    doc.setFillColor(255,255,255);doc.setDrawColor(...border);doc.setLineWidth(.008);\n    doc.roundedRect(contentX,y,contentW,outerH,.08,.08,'FD');\n    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...orange);\n    doc.text(String(title||'').toUpperCase(),contentX+pad,y+.23);\n    const groupY=y+pad+titleH;\n    doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...muted);\n    doc.text('CONTINGENCY',contentX+pad,groupY+.11);\n    doc.text('PROJECT FINANCIALS',contentX+pad+contingencyW+gap,groupY+.11);\n    const cellY=groupY+groupH;\n    const drawCell=(x,w,label,value)=>{\n      doc.setFillColor(...light);doc.setDrawColor(...border);doc.roundedRect(x,cellY,w,cellH,.06,.06,'FD');\n      doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...text);\n      doc.text(String(label||'').toUpperCase(),x+.10,cellY+.18);\n      doc.setFont('helvetica','normal');doc.setFontSize(10.5);doc.setTextColor(...text);\n      const lines=doc.splitTextToSize(String(value||'—'),w-.20);\n      doc.text(lines,x+.10,cellY+.40,{lineHeightFactor:1.1});\n    };\n    drawCell(contentX+pad,contingencyW,'Contingency %',contingency);\n    row.forEach((item,idx)=>drawCell(contentX+pad+contingencyW+gap+idx*(finCellW+gap),finCellW,item?.[0],item?.[1]));\n    return y+outerH+.11;\n  }\n`;

    source = source.slice(0, anchorIndex) + financialBoxHelper + source.slice(anchorIndex);

    const summaryPattern = /  y=drawTwoColumnRows\(y,\[\[\['Owner \/ Client',info\.owner\|\|p\.clientName\],[\s\S]*?\]\]\);\n/;
    if (!summaryPattern.test(source)) {
      console.warn('Kickoff financial PDF layout patch could not find the project summary rows.');
      return;
    }

    const contingencyValue = "String(info.contingencyPercent||'').trim()?sanitizeContingencyPercent(info.contingencyPercent).replace(/\\.$/,'')+'%':''";
    const grossProfitValue = "String(info.projectCost||'').trim()?formatMoneyNumber(moneyNumber(info.revenue||info.contractValue||'')-moneyNumber(info.projectCost||'')):(info.grossProfit||'')";
    const selfPerformContingencyValue = "String(info.selfPerformContingencyPercent||'').trim()?sanitizeContingencyPercent(info.selfPerformContingencyPercent).replace(/\\.$/,'')+'%':''";
    const selfPerformGrossProfitValue = "String(info.selfPerformProjectCost||'').trim()?formatMoneyNumber(moneyNumber(info.selfPerformRevenue||'')-moneyNumber(info.selfPerformProjectCost||'')):(info.selfPerformGrossProfit||'')";

    const summaryReplacement =
      "  y=drawProjectDetailsBox(y,[['Owner / Client',info.owner||p.clientName],['Contract Type',info.contractType],['Tax Status',info.taxStatus],['Start Date',info.startDate?fmtDate(info.startDate):'—'],['End Date',info.endDate?fmtDate(info.endDate):'—'],['Project Location',info.projectLocation||p.projectAddress||'']]);\n" +
      "  if(String(info.contractRequirements||'').trim())y=drawSection(y,'Liquidated Damages, Wage Requirements, BABA & Allowances',info.contractRequirements);\n";

    source = source.replace(summaryPattern, summaryReplacement);

    // Project Location now lives inside Project Details.
    source = source.replace("  y=drawSection(y,'Project Location',info.projectLocation||p.projectAddress||'');\n", "");

    const designTeamLine = "  y=drawSection(y,'Design Team',info.designTeam||'');";
    if (!source.includes(designTeamLine)) {
      console.warn('Kickoff hybrid PDF layout could not find the Design Team section.');
      return;
    }
    const financialAfterDesign =
      designTeamLine + "\n" +
      "  y=ensureSpace(y,info.selfPerformEnabled?2.75:1.55);\n" +
      "  y=drawKickoffSectionLabel(y,'Project Financial Information');\n" +
      "  y=drawProjectFinancialSection(y,'General Contractor Project'," + contingencyValue + ",[['Revenue',info.revenue||info.contractValue||''],['Project Cost',info.projectCost||''],['Gross Profit'," + grossProfitValue + "]]);\n" +
      "  if(info.selfPerformEnabled)y=drawProjectFinancialSection(y,'Self Perform Project'," + selfPerformContingencyValue + ",[['Revenue',info.selfPerformRevenue||''],['Project Cost',info.selfPerformProjectCost||''],['Gross Profit'," + selfPerformGrossProfitValue + "]]);";
    source = source.replace(designTeamLine, financialAfterDesign);


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
