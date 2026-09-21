(() => {
  // Reduce downloaded Proposal PDF size without changing image resolution or
  // converting the 300-DPI marketing artwork to a lossy format.
  // Preview stays FAST; final export uses jsPDF's strongest lossless PNG compression.
  if (typeof exportPdf !== 'function') {
    console.warn('Proposal PDF size optimization skipped: exportPdf unavailable.');
    return;
  }
  if (window.__proposalPdfLosslessSizeOptimization === '2026-09-21-1') return;

  let source = exportPdf.toString();
  const replacements = [
    {
      from: "doc.addImage(coverData,'PNG',0,0,pageW,coverPageH,undefined,'FAST')",
      to: "doc.addImage(coverData,'PNG',0,0,pageW,coverPageH,undefined,fastPreview?'FAST':'SLOW')"
    },
    {
      from: "doc.addImage(interiorData,'PNG',0,0,pageW,pageH,undefined,'FAST')",
      to: "doc.addImage(interiorData,'PNG',0,0,pageW,pageH,undefined,fastPreview?'FAST':'SLOW')"
    }
  ];

  let changed = 0;
  replacements.forEach(({ from, to }) => {
    if (source.includes(from)) {
      source = source.replace(from, to);
      changed++;
    }
  });

  if (!changed) {
    console.warn('Proposal PDF size optimization could not find PNG compression hooks.');
    return;
  }

  try {
    const patchedExportPdf = eval(`(${source})`);
    exportPdf = patchedExportPdf;
    window.exportPdf = patchedExportPdf;

    // The Export PDF button is bound directly in the core app. Rebind it once
    // so the click uses the optimized exporter rather than the prior function.
    const oldButton = document.getElementById('exportPdfBtn');
    if (oldButton && oldButton.dataset.losslessPdfSizeOptimized !== 'true') {
      const newButton = oldButton.cloneNode(true);
      newButton.dataset.losslessPdfSizeOptimized = 'true';
      oldButton.replaceWith(newButton);
      newButton.addEventListener('click', patchedExportPdf);
    }

    window.__proposalPdfLosslessSizeOptimization = '2026-09-21-1';
  } catch (error) {
    console.error('Proposal PDF size optimization failed.', error);
  }
})();