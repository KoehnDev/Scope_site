(() => {
  // Keep underlines continuous across spaces in all custom PDF rich-text renderers.
  // The core renderers split styled text into word/space tokens, and previously
  // skipped drawing an underline for whitespace-only tokens.
  //
  // Important: this patch rebuilds PDF functions from source. Any helper that a
  // later runtime PDF patch closes over must also exist in this closure. The
  // Kickoff Project Financials layout uses sanitizeContingencyPercent(), so keep
  // the helper here to prevent the rebuilt Kickoff PDF function from throwing.
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

  function patchPdfFunction(name) {
    let fn;
    try {
      fn = name === 'exportPdf'
        ? (typeof exportPdf === 'function' ? exportPdf : window.exportPdf)
        : (typeof buildKickoffPdf === 'function' ? buildKickoffPdf : window.buildKickoffPdf);
    } catch {
      fn = window[name];
    }
    if (typeof fn !== 'function') return false;
    if (fn.__continuousUnderlineSpaces) return true;

    const source = fn.toString();
    const pattern = /run\.underline\s*&&\s*run\.text\.trim\(\)/g;
    const matches = source.match(pattern) || [];
    if (!matches.length) {
      // A later patch may already contain the corrected behavior.
      if (/run\.underline\s*&&\s*String\(run\.text\|\|['"]{2}\)\.length/.test(source)) {
        fn.__continuousUnderlineSpaces = true;
        return true;
      }
      return false;
    }

    const patchedSource = source.replace(pattern, "run.underline&&String(run.text||'').length");
    try {
      const patched = eval(`(${patchedSource})`);
      patched.__continuousUnderlineSpaces = true;

      if (name === 'exportPdf') {
        exportPdf = patched;
        window.exportPdf = patched;

        // Proposal export is bound directly to the function, so refresh that
        // listener whenever the exporter is replaced.
        const oldButton = document.getElementById('exportPdfBtn');
        if (oldButton) {
          const newButton = oldButton.cloneNode(true);
          newButton.dataset.continuousUnderlineSpaces = 'true';
          oldButton.replaceWith(newButton);
          newButton.addEventListener('click', patched);
        }
      } else {
        buildKickoffPdf = patched;
        window.buildKickoffPdf = patched;
      }
      return true;
    } catch (error) {
      console.error(`Continuous underline patch failed for ${name}.`, error);
      return false;
    }
  }

  function apply() {
    patchPdfFunction('exportPdf');
    patchPdfFunction('buildKickoffPdf');
  }

  apply();

  // Several existing Scope Site enhancements patch the PDF builders at runtime.
  // Re-check briefly during startup so this stays the final rendering behavior.
  let tries = 0;
  const timer = setInterval(() => {
    apply();
    tries += 1;
    if (tries >= 80) clearInterval(timer);
  }, 100);
})();
