(() => {
  // Match the Kickoff live PDF experience to the Proposal preview:
  // - same pause-before-render behavior
  // - same lightweight 1x lazy rendering
  // - same show/hide preview controls
  if (typeof state === 'undefined' || typeof buildKickoffPdf !== 'function' || typeof mountLazyPdfPreview !== 'function') {
    console.warn('Kickoff preview controls skipped: core preview functions are unavailable.');
    return;
  }

  state.kickoffPreviewOpen = state.kickoffPreviewOpen !== false;
  state.kickoffPreviewLastEditAt = Number(state.kickoffPreviewLastEditAt || 0);
  state.kickoffPreviewIdleMs = Number(state.previewIdleMs || 1200);

  const style = document.createElement('style');
  style.textContent = `
    .kickoff-topbar-actions{display:flex;align-items:center;gap:10px;margin-left:auto}
    .kickoff-workspace-grid.kickoff-preview-off{grid-template-columns:minmax(0,1fr)!important}
    .kickoff-live-preview-head-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-left:auto}
    .kickoff-live-preview-head-actions>span{max-width:145px;color:#878c90;font-size:8px;line-height:1.3;text-align:right}
    .kickoff-live-preview-close{width:30px;height:30px;font-size:17px;flex:0 0 auto}
    @media (max-width:700px){.kickoff-topbar-actions{gap:7px}.kickoff-preview-toggle{padding:9px 11px}}
  `;
  document.head.appendChild(style);

  function ensureKickoffPreviewControls() {
    const topbar = document.querySelector('.kickoff-topbar');
    const exportButton = document.getElementById('exportKickoffPdfBtn');
    const pane = document.getElementById('kickoffLivePreviewPane');
    const head = pane?.querySelector('.kickoff-live-preview-head');

    if (topbar && exportButton && !document.getElementById('kickoffPreviewToggle')) {
      let actions = topbar.querySelector('.kickoff-topbar-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'kickoff-topbar-actions';
        topbar.insertBefore(actions, exportButton);
        actions.appendChild(exportButton);
      }
      const toggle = document.createElement('button');
      toggle.id = 'kickoffPreviewToggle';
      toggle.className = 'btn btn-secondary kickoff-preview-toggle';
      toggle.type = 'button';
      toggle.addEventListener('click', () => toggleKickoffPreview());
      actions.insertBefore(toggle, exportButton);
    }

    if (head && !document.getElementById('closeKickoffPreviewBtn')) {
      const existingNote = head.querySelector(':scope > span');
      const actions = document.createElement('div');
      actions.className = 'kickoff-live-preview-head-actions';
      if (existingNote) actions.appendChild(existingNote);
      const close = document.createElement('button');
      close.id = 'closeKickoffPreviewBtn';
      close.className = 'icon-btn kickoff-live-preview-close';
      close.type = 'button';
      close.setAttribute('aria-label', 'Hide kickoff PDF preview');
      close.textContent = '×';
      close.addEventListener('click', () => toggleKickoffPreview(false));
      actions.appendChild(close);
      head.appendChild(actions);
    }
  }

  function syncKickoffPreviewUi() {
    ensureKickoffPreviewControls();
    const pane = document.getElementById('kickoffLivePreviewPane');
    const grid = document.querySelector('.kickoff-workspace-grid');
    const toggle = document.getElementById('kickoffPreviewToggle');
    const open = state.kickoffPreviewOpen !== false;
    pane?.classList.toggle('hidden', !open);
    grid?.classList.toggle('kickoff-preview-off', !open);
    if (toggle) toggle.textContent = open ? 'Hide Preview' : 'PDF Preview';
  }

  function toggleKickoffPreview(open) {
    state.kickoffPreviewOpen = open ?? !state.kickoffPreviewOpen;
    clearTimeout(state.kickoffPreviewTimer);
    if (!state.kickoffPreviewOpen) {
      state.kickoffPreviewToken += 1;
      state.kickoffPreviewPending = false;
    }
    syncKickoffPreviewUi();
    if (state.kickoffPreviewOpen) scheduleKickoffPdfPreviewMatched(40);
  }

  function scheduleKickoffPdfPreviewMatched(delay = 1200) {
    clearTimeout(state.kickoffPreviewTimer);
    if (!state.kickoffPreviewOpen || !state.currentKickoffProjectId) return;

    const requested = Math.max(0, Number(delay) || 0);
    const elapsed = Date.now() - (state.kickoffPreviewLastEditAt || 0);
    const wait = state.kickoffPreviewLastEditAt && elapsed < state.kickoffPreviewIdleMs
      ? Math.max(40, state.kickoffPreviewIdleMs - elapsed)
      : requested;
    state.kickoffPreviewTimer = setTimeout(renderKickoffPdfPreviewMatched, wait);
  }

  async function renderKickoffPdfPreviewMatched() {
    if (!state.kickoffPreviewOpen || !state.currentKickoffProjectId) return;

    const idleFor = Date.now() - (state.kickoffPreviewLastEditAt || 0);
    if (state.kickoffPreviewLastEditAt && idleFor < state.kickoffPreviewIdleMs) {
      scheduleKickoffPdfPreviewMatched(state.kickoffPreviewIdleMs - idleFor + 40);
      return;
    }
    if (state.kickoffPreviewRendering) {
      state.kickoffPreviewPending = true;
      return;
    }

    const liveWrap = document.getElementById('kickoffLivePreviewPages');
    const liveStatus = document.getElementById('kickoffLivePreviewStatus');
    const liveScroll = document.getElementById('kickoffLivePreviewScroll');
    const tabWrap = document.getElementById('kickoffPdfPreviewPages');
    const tabStatus = document.getElementById('kickoffPdfPreviewStatus');
    if (!liveWrap && !tabWrap) return;

    state.kickoffPreviewRendering = true;
    state.kickoffPreviewPending = false;
    const token = ++state.kickoffPreviewToken;
    const isCurrent = () => token === state.kickoffPreviewToken && state.kickoffPreviewOpen !== false;

    if (liveStatus) {
      liveStatus.textContent = 'Updating kickoff PDF…';
      liveStatus.classList.remove('hidden');
    }
    if (state.currentKickoffTab === 'preview' && tabStatus) {
      tabStatus.textContent = 'Updating kickoff PDF…';
      tabStatus.classList.remove('hidden');
    }

    try {
      const doc = await buildKickoffPdf({ preview: true });
      if (!doc || !isCurrent()) return;
      if (!window.pdfjsLib) throw new Error('Preview renderer unavailable.');
      if (window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      const pdf = await window.pdfjsLib.getDocument({ data: doc.output('arraybuffer') }).promise;
      if (!isCurrent()) {
        try { pdf.destroy?.(); } catch {}
        return;
      }

      if (liveWrap && liveScroll) {
        await mountLazyPdfPreview(pdf, liveWrap, liveScroll, { token, isCurrent, maxWidth: 400, dprCap: 1 });
        if (isCurrent() && liveStatus) liveStatus.classList.add('hidden');
      }
      if (state.currentKickoffTab === 'preview' && tabWrap) {
        await mountLazyPdfPreview(pdf, tabWrap, tabWrap, { token, isCurrent, maxWidth: 760, dprCap: 1 });
        if (isCurrent() && tabStatus) tabStatus.classList.add('hidden');
      }
    } catch (err) {
      console.error(err);
      if (isCurrent()) {
        if (liveStatus) {
          liveStatus.textContent = 'Kickoff preview unavailable. Export PDF is still available.';
          liveStatus.classList.remove('hidden');
        }
        if (tabStatus && state.currentKickoffTab === 'preview') {
          tabStatus.textContent = 'Kickoff preview unavailable. Try Export Kickoff PDF.';
          tabStatus.classList.remove('hidden');
        }
      }
    } finally {
      state.kickoffPreviewRendering = false;
      if (state.kickoffPreviewPending && state.kickoffPreviewOpen) {
        state.kickoffPreviewPending = false;
        scheduleKickoffPdfPreviewMatched(state.kickoffPreviewIdleMs);
      }
    }
  }

  document.addEventListener('input', event => {
    if (!event.target?.closest?.('#kickoffView')) return;
    state.kickoffPreviewLastEditAt = Date.now();
    if (state.kickoffPreviewRendering) state.kickoffPreviewToken += 1;
    scheduleKickoffPdfPreviewMatched(state.kickoffPreviewIdleMs);
  }, true);

  scheduleKickoffPdfPreview = scheduleKickoffPdfPreviewMatched;
  renderKickoffPdfPreview = renderKickoffPdfPreviewMatched;
  window.scheduleKickoffPdfPreview = scheduleKickoffPdfPreviewMatched;
  window.renderKickoffPdfPreview = renderKickoffPdfPreviewMatched;
  window.toggleKickoffPreview = toggleKickoffPreview;

  syncKickoffPreviewUi();
})();

(() => {
  // Load the additional Kickoff-only Project Information fields.
  if (!document.querySelector('script[data-kickoff-project-info-fields]')) {
    const script = document.createElement('script');
    script.src = 'kickoff-project-info-fields.js?v=20260925-1';
    script.async = false;
    script.dataset.kickoffProjectInfoFields = 'true';
    script.onerror = () => console.error('Kickoff project information fields failed to load.');
    document.head.appendChild(script);
  }
})();

(() => {
  // Compact the Kickoff financial summary after the Project Information fields load.
  if (!document.querySelector('script[data-kickoff-financial-pdf-layout]')) {
    const script = document.createElement('script');
    script.src = 'kickoff-financial-pdf-layout.js?v=20260925-1';
    script.async = false;
    script.dataset.kickoffFinancialPdfLayout = 'true';
    script.onerror = () => console.error('Kickoff financial PDF layout failed to load.');
    document.head.appendChild(script);
  }
})();
