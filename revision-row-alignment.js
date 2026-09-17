(() => {
  // Keep the Original / Current revision columns aligned line-by-line so scope
  // headings and paragraphs remain easy to read straight across.
  if (typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
    #revisionResults .revision-diff-placeholder{
      visibility:hidden;
      pointer-events:none;
    }
    #revisionResults .revision-diff-line{
      box-sizing:border-box;
    }
  `;
  document.head.appendChild(style);

  function lineOperations(beforeLines, afterLines) {
    const a = beforeLines.map(line => String(line.textContent || ''));
    const b = afterLines.map(line => String(line.textContent || ''));
    const n = a.length, m = b.length;

    if (n * m > 40000) {
      let start = 0;
      while (start < n && start < m && a[start] === b[start]) start++;
      let ai = n - 1, bi = m - 1;
      while (ai >= start && bi >= start && a[ai] === b[bi]) { ai--; bi--; }
      return [
        ...a.slice(0, start).map(() => ({ type: 'same' })),
        ...a.slice(start, ai + 1).map(() => ({ type: 'remove' })),
        ...b.slice(start, bi + 1).map(() => ({ type: 'add' })),
        ...a.slice(ai + 1).map(() => ({ type: 'same' }))
      ];
    }

    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        ops.push({ type: 'same' });
        i++; j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({ type: 'remove' });
        i++;
      } else {
        ops.push({ type: 'add' });
        j++;
      }
    }
    while (i++ < n) ops.push({ type: 'remove' });
    while (j++ < m) ops.push({ type: 'add' });
    return ops;
  }

  function placeholder() {
    const line = document.createElement('div');
    line.className = 'revision-diff-line revision-diff-placeholder';
    line.innerHTML = '&nbsp;';
    return line;
  }

  function pairRenderedLines(beforeBox, afterBox) {
    const beforeLines = [...beforeBox.children].filter(el => el.classList.contains('revision-diff-line'));
    const afterLines = [...afterBox.children].filter(el => el.classList.contains('revision-diff-line'));
    if (!beforeLines.length && !afterLines.length) return [];

    const ops = lineOperations(beforeLines, afterLines);
    const pairs = [];
    let bi = 0, ai = 0, oi = 0;

    while (oi < ops.length) {
      if (ops[oi].type === 'same') {
        pairs.push([beforeLines[bi++], afterLines[ai++]]);
        oi++;
        continue;
      }

      const removed = [];
      const added = [];
      while (oi < ops.length && ops[oi].type !== 'same') {
        if (ops[oi].type === 'remove') removed.push(beforeLines[bi++]);
        else if (ops[oi].type === 'add') added.push(afterLines[ai++]);
        oi++;
      }

      const count = Math.max(removed.length, added.length);
      for (let k = 0; k < count; k++) {
        pairs.push([removed[k] || placeholder(), added[k] || placeholder()]);
      }
    }

    beforeBox.replaceChildren(...pairs.map(pair => pair[0]));
    afterBox.replaceChildren(...pairs.map(pair => pair[1]));
    return pairs;
  }

  function syncPairHeights(pairs) {
    pairs.forEach(([beforeLine, afterLine]) => {
      beforeLine.style.minHeight = '';
      afterLine.style.minHeight = '';
    });

    // Measure after both columns are in their final widths, then force each
    // logical row to the taller of the two sides.
    pairs.forEach(([beforeLine, afterLine]) => {
      const height = Math.ceil(Math.max(
        beforeLine.getBoundingClientRect().height,
        afterLine.getBoundingClientRect().height
      ));
      if (height > 0) {
        beforeLine.style.minHeight = `${height}px`;
        afterLine.style.minHeight = `${height}px`;
      }
    });
  }

  function alignRevisionRows() {
    const root = document.getElementById('revisionResults');
    if (!root) return;

    root.querySelectorAll('.revision-row').forEach(row => {
      const cols = row.querySelectorAll('.revision-col');
      if (cols.length < 2) return;
      const beforeBox = cols[0].querySelector('.revision-diff-text');
      const afterBox = cols[1].querySelector('.revision-diff-text');
      if (!beforeBox || !afterBox) return;

      let pairs;
      if (row.dataset.revisionRowsAligned === '1') {
        const beforeLines = [...beforeBox.children].filter(el => el.classList.contains('revision-diff-line'));
        const afterLines = [...afterBox.children].filter(el => el.classList.contains('revision-diff-line'));
        const count = Math.min(beforeLines.length, afterLines.length);
        pairs = Array.from({ length: count }, (_, index) => [beforeLines[index], afterLines[index]]);
      } else {
        pairs = pairRenderedLines(beforeBox, afterBox);
        row.dataset.revisionRowsAligned = '1';
      }
      syncPairHeights(pairs);
    });
  }

  function scheduleAlignment() {
    queueMicrotask(() => requestAnimationFrame(() => requestAnimationFrame(alignRevisionRows)));
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#editorView [data-tab="history"]')) scheduleAlignment();
  });

  document.addEventListener('change', event => {
    if (event.target?.matches?.('#revisionCompare')) scheduleAlignment();
  });

  if (typeof populateEditor === 'function' && !populateEditor.__revisionRowAlignment) {
    const originalPopulate = populateEditor;
    const wrappedPopulate = function() {
      const result = originalPopulate.apply(this, arguments);
      scheduleAlignment();
      return result;
    };
    wrappedPopulate.__revisionRowAlignment = true;
    populateEditor = wrappedPopulate;
    window.populateEditor = wrappedPopulate;
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(alignRevisionRows, 120);
  });

  scheduleAlignment();
  window.alignRevisionRows = alignRevisionRows;
})();
