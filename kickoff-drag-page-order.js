(() => {
  // Drag-and-drop reordering for Kickoff > Quotes & Page Order.
  // Uses the same page-order tokens and persistence path as the existing arrows.
  if (typeof state === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
    /* Keep the original compact page-order layout; movable rows simply gain
       one narrow drag-handle column. */
    .kickoff-page-order-row[data-kickoff-page-token]{position:relative;grid-template-columns:24px 34px minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;padding:8px 10px!important;min-height:0!important}
    .kickoff-page-order-row.fixed{grid-template-columns:34px minmax(0,1fr) auto!important;padding:8px 10px!important;min-height:0!important}
    .kickoff-page-order-row[data-kickoff-page-token] .kickoff-page-order-index{width:26px;height:26px}
    .kickoff-page-order-row[data-kickoff-page-token] .kickoff-page-order-actions .btn-small{min-width:30px;min-height:28px;padding:4px 7px}
    .kickoff-page-drag-handle{display:inline-flex!important;align-items:center;justify-content:center;width:22px;height:28px;margin:0!important;border:0;background:transparent;color:#8a8f93;font-size:15px!important;line-height:1!important;cursor:grab;user-select:none;touch-action:none;border-radius:5px;flex:0 0 auto}
    .kickoff-page-drag-handle:hover{background:#f1f3f4;color:#555b60}
    .kickoff-page-drag-handle:active{cursor:grabbing}
    .kickoff-page-order-row.kickoff-dragging{opacity:.45}
    .kickoff-page-order-row.kickoff-drop-before::before,.kickoff-page-order-row.kickoff-drop-after::after{content:'';position:absolute;left:8px;right:8px;height:3px;border-radius:999px;background:#f36f21;z-index:4;pointer-events:none}
    .kickoff-page-order-row.kickoff-drop-before::before{top:-3px}
    .kickoff-page-order-row.kickoff-drop-after::after{bottom:-3px}
    .kickoff-page-order-drag-note{display:flex;align-items:center;gap:6px;margin:0 0 8px;color:#777d81;font-size:10px}
    .kickoff-page-order-drag-note strong{color:#555b60}
    @media (max-width:700px){
      .kickoff-page-order-row[data-kickoff-page-token]{grid-template-columns:24px 34px minmax(0,1fr)!important;align-items:start!important}
      .kickoff-page-order-row[data-kickoff-page-token] .kickoff-page-order-actions{grid-column:3!important;justify-self:start}
      .kickoff-page-order-row.fixed{grid-template-columns:34px minmax(0,1fr)!important}
      .kickoff-page-order-row.fixed .kickoff-page-order-fixed{grid-column:2!important;justify-self:start}
    }
  `;
  document.head.appendChild(style);

  let activeToken = '';
  let activeRow = null;

  function clearDropIndicators(wrap = document.getElementById('kickoffPageOrder')) {
    wrap?.querySelectorAll('.kickoff-drop-before,.kickoff-drop-after').forEach(row => {
      row.classList.remove('kickoff-drop-before','kickoff-drop-after');
    });
  }

  function enhanceKickoffPageOrderDrag() {
    const wrap = document.getElementById('kickoffPageOrder');
    if (!wrap) return false;

    const rows = [...wrap.querySelectorAll('.kickoff-page-order-row[data-kickoff-page-token]')];
    rows.forEach(row => {
      if (row.querySelector('.kickoff-page-drag-handle')) return;
      const handle = document.createElement('span');
      handle.className = 'kickoff-page-drag-handle';
      handle.draggable = true;
      handle.setAttribute('role','button');
      handle.setAttribute('tabindex','0');
      handle.setAttribute('aria-label','Drag to reorder this kickoff page item');
      handle.setAttribute('title','Drag to reorder');
      handle.textContent = '⋮⋮';
      row.insertBefore(handle,row.firstChild);
    });

    if (!wrap.previousElementSibling?.classList?.contains('kickoff-page-order-drag-note')) {
      const note = document.createElement('div');
      note.className = 'kickoff-page-order-drag-note';
      note.innerHTML = '<strong>Drag to reorder:</strong> grab the ⋮⋮ handle on any Division or Quote. Arrow buttons still work.';
      wrap.parentNode?.insertBefore(note,wrap);
    }

    if (wrap.dataset.kickoffDragBound === '1') return true;
    wrap.dataset.kickoffDragBound = '1';

    wrap.addEventListener('dragstart', event => {
      const handle = event.target?.closest?.('.kickoff-page-drag-handle');
      const row = handle?.closest?.('.kickoff-page-order-row[data-kickoff-page-token]');
      if (!handle || !row) return;
      activeToken = String(row.dataset.kickoffPageToken || '');
      activeRow = row;
      row.classList.add('kickoff-dragging');
      try {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain',activeToken);
      } catch {}
    });

    wrap.addEventListener('dragover', event => {
      if (!activeToken) return;
      const target = event.target?.closest?.('.kickoff-page-order-row[data-kickoff-page-token]');
      if (!target || target === activeRow) return;
      event.preventDefault();
      try { event.dataTransfer.dropEffect = 'move'; } catch {}
      clearDropIndicators(wrap);
      const box = target.getBoundingClientRect();
      const after = event.clientY > box.top + box.height / 2;
      target.classList.add(after ? 'kickoff-drop-after' : 'kickoff-drop-before');
    });

    wrap.addEventListener('drop', event => {
      if (!activeToken) return;
      const target = event.target?.closest?.('.kickoff-page-order-row[data-kickoff-page-token]');
      if (!target || target === activeRow) return;
      event.preventDefault();
      const box = target.getBoundingClientRect();
      const after = event.clientY > box.top + box.height / 2;
      const targetToken = String(target.dataset.kickoffPageToken || '');
      moveKickoffPageTokenByDrag(activeToken,targetToken,after);
    });

    wrap.addEventListener('dragend', () => {
      activeRow?.classList.remove('kickoff-dragging');
      clearDropIndicators(wrap);
      activeToken = '';
      activeRow = null;
    });
    return true;
  }

  function moveKickoffPageTokenByDrag(sourceToken,targetToken,after) {
    if (!sourceToken || !targetToken || sourceToken === targetToken) return;
    try {
      if (document.querySelector('.kickoff-division-card') && typeof collectKickoffDivisionsFromDom === 'function') collectKickoffDivisionsFromDom();
      if (typeof getCurrentKickoffProject !== 'function' || !getCurrentKickoffProject()) return;
      if (typeof mutateKickoff !== 'function' || typeof normalizedKickoffPageOrder !== 'function' || typeof applyKickoffPageOrder !== 'function') return;

      mutateKickoff(k => {
        const order = normalizedKickoffPageOrder(k);
        const sourceIndex = order.indexOf(sourceToken);
        if (sourceIndex < 0) return;
        order.splice(sourceIndex,1);
        let targetIndex = order.indexOf(targetToken);
        if (targetIndex < 0) return;
        if (after) targetIndex += 1;
        order.splice(targetIndex,0,sourceToken);
        applyKickoffPageOrder(k,order,{reassociateQuotes:false});
      });

      if (typeof renderKickoffDivisions === 'function') renderKickoffDivisions();
      if (typeof renderKickoffPageOrder === 'function') renderKickoffPageOrder();
      if (typeof renderKickoffQuotes === 'function') renderKickoffQuotes();
      if (typeof scheduleKickoffPdfPreview === 'function') scheduleKickoffPdfPreview(220);
      if (typeof toast === 'function') toast('Kickoff page order updated.');
    } finally {
      activeRow?.classList.remove('kickoff-dragging');
      activeToken = '';
      activeRow = null;
      queueMicrotask(enhanceKickoffPageOrderDrag);
    }
  }

  if (typeof renderKickoffPageOrder === 'function' && !renderKickoffPageOrder.__kickoffDragOrder) {
    const originalRender = renderKickoffPageOrder;
    const wrappedRender = function() {
      const result = originalRender.apply(this,arguments);
      queueMicrotask(enhanceKickoffPageOrderDrag);
      return result;
    };
    wrappedRender.__kickoffDragOrder = true;
    renderKickoffPageOrder = wrappedRender;
    window.renderKickoffPageOrder = wrappedRender;
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('[data-kickoff-tab="documents"],[data-kickoff-page-up],[data-kickoff-page-down]')) {
      requestAnimationFrame(enhanceKickoffPageOrderDrag);
    }
  });

  enhanceKickoffPageOrderDrag();
  window.enhanceKickoffPageOrderDrag = enhanceKickoffPageOrderDrag;
})();