(() => {
  // Make Proposal Revision Comparison visual-first: unchanged text stays quiet,
  // while the exact changed wording is bold and highlighted.
  if (typeof document === 'undefined') return;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const style = document.createElement('style');
  style.textContent = `
    #revisionResults .revision-compare-legend{
      display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;
      margin:10px 0 2px;padding:9px 11px;border:1px solid #e5e7e9;
      border-radius:8px;background:#fbfbfb;color:#656a6f;font-size:10px;line-height:1.35
    }
    #revisionResults .revision-compare-legend strong{color:#33383c;font-size:10px}
    #revisionResults .revision-legend-swatch{display:inline-block;width:12px;height:8px;border-radius:3px;margin-right:4px;vertical-align:middle}
    #revisionResults .revision-legend-before{background:#ffe9e6;border:1px solid #efb0a8}
    #revisionResults .revision-legend-after{background:#fff0e5;border:1px solid #f2b184}
    #revisionResults .revision-row{background:#fff;border-left:3px solid #f36f21;padding:0;overflow:hidden}
    #revisionResults .revision-row summary{
      display:flex;align-items:center;gap:8px;padding:10px 11px;
      background:#fafafa;border-bottom:1px solid transparent;list-style-position:inside
    }
    #revisionResults .revision-row[open] summary{border-bottom-color:#e5e7e9}
    #revisionResults .revision-change-badge{
      margin-left:auto;flex:0 0 auto;padding:3px 7px;border-radius:999px;
      background:#fff0e5;color:#a9440c;font-size:8px;font-weight:800;letter-spacing:.045em;text-transform:uppercase
    }
    #revisionResults .revision-cols{gap:12px;margin:0;padding:11px;background:#fff}
    #revisionResults .revision-col{
      min-width:0;border:1px solid #e1e4e6;border-radius:9px;background:#fff;padding:10px 11px
    }
    #revisionResults .revision-col>span{
      display:block;margin-bottom:7px;padding-bottom:6px;border-bottom:1px solid #eceeef;
      color:#73787d;font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase
    }
    #revisionResults .revision-diff-text{
      white-space:normal;overflow-wrap:anywhere;color:#30353a;font:400 12px/1.48 Inter,Arial,sans-serif
    }
    #revisionResults .revision-diff-line{min-height:1.48em;white-space:pre-wrap}
    #revisionResults .revision-diff-line+.revision-diff-line{margin-top:1px}
    #revisionResults .revision-diff-change{
      font-weight:800;border-radius:3px;padding:1px 2px;margin:0 -1px
    }
    #revisionResults .revision-diff-before .revision-diff-change{background:#ffe9e6;color:#8b2920}
    #revisionResults .revision-diff-after .revision-diff-change{background:#fff0e5;color:#9d3f08}
    #revisionResults .revision-diff-empty{color:#9aa0a5;font-style:italic}
    @media(max-width:700px){#revisionResults .revision-cols{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function wordChangePair(beforeLine, afterLine) {
    const a = String(beforeLine ?? '').match(/\s+|[^\s]+/g) || [];
    const b = String(afterLine ?? '').match(/\s+|[^\s]+/g) || [];
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    let aEnd = a.length - 1;
    let bEnd = b.length - 1;
    while (aEnd >= start && bEnd >= start && a[aEnd] === b[bEnd]) { aEnd--; bEnd--; }

    const prefix = a.slice(0, start).map(esc).join('');
    const suffixA = a.slice(aEnd + 1).map(esc).join('');
    const suffixB = b.slice(bEnd + 1).map(esc).join('');
    const changedA = a.slice(start, aEnd + 1).map(esc).join('');
    const changedB = b.slice(start, bEnd + 1).map(esc).join('');

    return {
      before: `${prefix}${changedA ? `<strong class="revision-diff-change">${changedA}</strong>` : ''}${suffixA}`,
      after: `${prefix}${changedB ? `<strong class="revision-diff-change">${changedB}</strong>` : ''}${suffixB}`
    };
  }

  function lineOperations(before, after) {
    const a = String(before ?? '').split('\n');
    const b = String(after ?? '').split('\n');
    const n = a.length, m = b.length;
    if (n * m > 40000) {
      // Large scopes: keep processing linear and still make the changed block obvious.
      let start = 0;
      while (start < n && start < m && a[start] === b[start]) start++;
      let ai = n - 1, bi = m - 1;
      while (ai >= start && bi >= start && a[ai] === b[bi]) { ai--; bi--; }
      return [
        ...a.slice(0, start).map((text, idx) => ({ type: 'same', before: text, after: b[idx] })),
        ...a.slice(start, ai + 1).map(text => ({ type: 'remove', text })),
        ...b.slice(start, bi + 1).map(text => ({ type: 'add', text })),
        ...a.slice(ai + 1).map((text, idx) => ({ type: 'same', before: text, after: b[bi + 1 + idx] }))
      ];
    }

    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { ops.push({ type: 'same', before: a[i], after: b[j] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'remove', text: a[i++] }); }
      else { ops.push({ type: 'add', text: b[j++] }); }
    }
    while (i < n) ops.push({ type: 'remove', text: a[i++] });
    while (j < m) ops.push({ type: 'add', text: b[j++] });
    return ops;
  }

  function renderPair(before, after) {
    const ops = lineOperations(before, after);
    const beforeLines = [];
    const afterLines = [];
    let i = 0;

    const normalLine = text => `<div class="revision-diff-line">${text === '' ? '<br>' : esc(text)}</div>`;
    const changedLine = html => `<div class="revision-diff-line"><strong class="revision-diff-change">${html || '&nbsp;'}</strong></div>`;

    while (i < ops.length) {
      const op = ops[i];
      if (op.type === 'same') {
        beforeLines.push(normalLine(op.before));
        afterLines.push(normalLine(op.after));
        i++;
        continue;
      }

      const removed = [];
      const added = [];
      while (i < ops.length && ops[i].type !== 'same') {
        if (ops[i].type === 'remove') removed.push(ops[i].text);
        if (ops[i].type === 'add') added.push(ops[i].text);
        i++;
      }

      const paired = Math.min(removed.length, added.length);
      for (let k = 0; k < paired; k++) {
        const pair = wordChangePair(removed[k], added[k]);
        beforeLines.push(`<div class="revision-diff-line">${pair.before || '<br>'}</div>`);
        afterLines.push(`<div class="revision-diff-line">${pair.after || '<br>'}</div>`);
      }
      for (let k = paired; k < removed.length; k++) beforeLines.push(changedLine(esc(removed[k])));
      for (let k = paired; k < added.length; k++) afterLines.push(changedLine(esc(added[k])));
    }

    return {
      before: beforeLines.length ? beforeLines.join('') : '<div class="revision-diff-empty">No text</div>',
      after: afterLines.length ? afterLines.join('') : '<div class="revision-diff-empty">No text</div>'
    };
  }

  function enhanceRevisionComparison() {
    const root = document.getElementById('revisionResults');
    if (!root) return;
    const list = root.querySelector('.revision-list');
    if (!list) return;

    if (!root.querySelector('.revision-compare-legend')) {
      const legend = document.createElement('div');
      legend.className = 'revision-compare-legend';
      legend.innerHTML = '<strong>Changes are bolded automatically.</strong><span><i class="revision-legend-swatch revision-legend-before"></i>Previous / replaced</span><span><i class="revision-legend-swatch revision-legend-after"></i>Current / added</span>';
      root.insertBefore(legend, list);
    }

    list.querySelectorAll('.revision-row').forEach(row => {
      if (row.dataset.revisionDiffEnhanced === '1') return;
      const cols = row.querySelectorAll('.revision-col');
      if (cols.length < 2) return;
      const beforePre = cols[0].querySelector('pre');
      const afterPre = cols[1].querySelector('pre');
      if (!beforePre || !afterPre) return;

      const rendered = renderPair(beforePre.textContent || '', afterPre.textContent || '');
      const beforeBox = document.createElement('div');
      beforeBox.className = 'revision-diff-text revision-diff-before';
      beforeBox.innerHTML = rendered.before;
      const afterBox = document.createElement('div');
      afterBox.className = 'revision-diff-text revision-diff-after';
      afterBox.innerHTML = rendered.after;
      beforePre.replaceWith(beforeBox);
      afterPre.replaceWith(afterBox);

      const summary = row.querySelector('summary');
      if (summary && !summary.querySelector('.revision-change-badge')) {
        const badge = document.createElement('span');
        badge.className = 'revision-change-badge';
        badge.textContent = 'Changed';
        summary.appendChild(badge);
      }
      row.open = true;
      row.dataset.revisionDiffEnhanced = '1';
    });
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#editorView [data-tab="history"]')) queueMicrotask(enhanceRevisionComparison);
  });

  document.addEventListener('change', event => {
    if (event.target?.matches?.('#revisionCompare')) queueMicrotask(enhanceRevisionComparison);
  });

  if (typeof populateEditor === 'function' && !populateEditor.__revisionHighlightEnhancement) {
    const originalPopulate = populateEditor;
    const wrappedPopulate = function() {
      const result = originalPopulate.apply(this, arguments);
      queueMicrotask(enhanceRevisionComparison);
      return result;
    };
    wrappedPopulate.__revisionHighlightEnhancement = true;
    populateEditor = wrappedPopulate;
    window.populateEditor = wrappedPopulate;
  }

  queueMicrotask(enhanceRevisionComparison);
  window.enhanceRevisionComparison = enhanceRevisionComparison;
})();
