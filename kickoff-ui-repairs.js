(() => {
  // Kickoff UI repairs — 2026-09-16
  // 1) Give the manual PDF preview its own clean refresh path so stale state from
  //    the former live preview cannot block a user-requested refresh.
  // 2) Add a second + Blank Division button at the bottom of the Divisions page.

  const style = document.createElement('style');
  style.textContent = `
    .kickoff-bottom-add-division{
      display:flex;
      justify-content:flex-end;
      align-items:center;
      width:100%;
      box-sizing:border-box;
      padding:16px 0 6px;
    }
    .kickoff-bottom-add-division .btn{min-width:158px}
    @media (max-width:700px){
      .kickoff-bottom-add-division .btn{width:100%}
    }
  `;
  document.head.appendChild(style);

  let refreshSequence = 0;

  function ensureBottomDivisionButton() {
    const tab = document.getElementById('kickoffDivisionsTab');
    if (!tab) return false;
    let wrap = document.getElementById('kickoffBottomAddDivisionWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'kickoffBottomAddDivisionWrap';
      wrap.className = 'kickoff-bottom-add-division';
      const button = document.createElement('button');
      button.id = 'addKickoffDivisionBottomBtn';
      button.className = 'btn btn-primary';
      button.type = 'button';
      button.textContent = '+ Blank Division';
      button.addEventListener('click', () => {
        if (typeof addKickoffDivision === 'function') addKickoffDivision();
      });
      wrap.appendChild(button);
      tab.appendChild(wrap);
    }
    return true;
  }

  function setKickoffPreviewOpen(open = true) {
    if (typeof state !== 'undefined') state.manualKickoffPreviewOpen = open;
    const pane = document.getElementById('kickoffLivePreviewPane');
    const grid = document.querySelector('.kickoff-workspace-grid');
    const toggle = document.getElementById('kickoffPreviewToggle');
    pane?.classList.toggle('hidden', !open);
    grid?.classList.toggle('kickoff-preview-off', !open);
    if (toggle) toggle.textContent = open ? 'Hide Preview' : 'PDF Preview';
  }

  function markPreviewDirty(message = 'Preview out of date · click Refresh Preview') {
    if (typeof state !== 'undefined') state.kickoffPreviewDirty = true;
    const status = document.getElementById('kickoffLivePreviewStatus');
    if (status && typeof state !== 'undefined' && state.currentKickoffProjectId) {
      status.textContent = message;
      status.classList.remove('hidden');
    }
  }

  async function refreshKickoffPreviewReliable() {
    if (typeof state === 'undefined' || !state.currentKickoffProjectId) return;
    if (typeof window.buildKickoffPdf !== 'function' || typeof mountLazyPdfPreview !== 'function') {
      markPreviewDirty('Kickoff preview unavailable. Export PDF is still available.');
      return;
    }

    setKickoffPreviewOpen(true);

    // Capture the latest form values immediately instead of waiting for autosave.
    try {
      if (typeof saveKickoffInfoFromForm === 'function') saveKickoffInfoFromForm();
      if (document.querySelector('.kickoff-division-card') && typeof collectKickoffDivisionsFromDom === 'function') {
        collectKickoffDivisionsFromDom();
      }
    } catch (error) {
      console.warn('Could not collect the latest Kickoff values before preview refresh.', error);
    }

    const liveWrap = document.getElementById('kickoffLivePreviewPages');
    const liveScroll = document.getElementById('kickoffLivePreviewScroll');
    const liveStatus = document.getElementById('kickoffLivePreviewStatus');
    const tabWrap = document.getElementById('kickoffPdfPreviewPages');
    const tabStatus = document.getElementById('kickoffPdfPreviewStatus');
    if (!liveWrap && !tabWrap) return;

    const button = document.getElementById('refreshKickoffManualPreviewBtn');
    const sequence = ++refreshSequence;
    const editStamp = Number(state.kickoffPreviewLastEditAt || 0);
    const isCurrent = () => sequence === refreshSequence && state.manualKickoffPreviewOpen !== false;

    // Do not inherit a stuck render flag from the retired live-preview scheduler.
    clearTimeout(state.kickoffPreviewTimer);
    state.kickoffPreviewPending = false;
    state.kickoffPreviewRendering = true;
    state.kickoffPreviewDirty = false;

    if (button) {
      button.disabled = true;
      button.textContent = 'Refreshing…';
    }
    if (liveStatus) {
      liveStatus.textContent = 'Refreshing kickoff PDF…';
      liveStatus.classList.remove('hidden');
    }
    if (state.currentKickoffTab === 'preview' && tabStatus) {
      tabStatus.textContent = 'Refreshing kickoff PDF…';
      tabStatus.classList.remove('hidden');
    }

    try {
      // Always call the current window-level builder. Other Scope Site patches replace
      // buildKickoffPdf at runtime, and the refresh button must use the final version.
      const doc = await window.buildKickoffPdf({ preview: true });
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
        await mountLazyPdfPreview(pdf, liveWrap, liveScroll, {
          token: sequence,
          isCurrent,
          maxWidth: 400,
          dprCap: 1
        });
      }
      if (state.currentKickoffTab === 'preview' && tabWrap) {
        await mountLazyPdfPreview(pdf, tabWrap, tabWrap, {
          token: sequence,
          isCurrent,
          maxWidth: 760,
          dprCap: 1
        });
      }

      if (!isCurrent()) return;
      const editedDuringRefresh = Number(state.kickoffPreviewLastEditAt || 0) > editStamp;
      state.kickoffPreviewDirty = editedDuringRefresh;
      if (editedDuringRefresh) {
        markPreviewDirty();
      } else {
        liveStatus?.classList.add('hidden');
        tabStatus?.classList.add('hidden');
      }
    } catch (error) {
      console.error('Kickoff PDF preview refresh failed.', error);
      if (isCurrent()) {
        state.kickoffPreviewDirty = true;
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
      // Always clear the flag. The old manual implementation could wait forever if
      // this value was left true by an interrupted live preview.
      state.kickoffPreviewRendering = false;
      state.kickoffPreviewPending = false;
      if (button) {
        button.disabled = false;
        button.textContent = 'Refresh Preview';
      }
    }
  }
  refreshKickoffPreviewReliable.__koehnReliableKickoffRefresh = true;

  function installReliableRefreshButton() {
    const pane = document.getElementById('kickoffLivePreviewPane');
    if (!pane) return false;
    const head = pane.querySelector('.kickoff-live-preview-head');
    if (!head) return false;

    let actions = head.querySelector('.kickoff-live-preview-head-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'kickoff-live-preview-head-actions';
      head.appendChild(actions);
    }

    let oldButton = document.getElementById('refreshKickoffManualPreviewBtn');
    let button;
    if (oldButton) {
      button = oldButton.cloneNode(true);
      oldButton.replaceWith(button);
    } else {
      button = document.createElement('button');
      button.id = 'refreshKickoffManualPreviewBtn';
      button.className = 'btn btn-secondary btn-small kickoff-manual-preview-refresh';
      button.type = 'button';
      const close = document.getElementById('closeKickoffPreviewBtn');
      if (close && close.parentElement === actions) actions.insertBefore(button, close);
      else actions.appendChild(button);
    }
    button.disabled = false;
    button.textContent = 'Refresh Preview';
    button.dataset.reliableKickoffRefresh = 'true';
    button.addEventListener('click', refreshKickoffPreviewReliable);

    window.refreshKickoffPreviewManual = refreshKickoffPreviewReliable;
    window.renderKickoffPdfPreview = refreshKickoffPreviewReliable;
    try { renderKickoffPdfPreview = refreshKickoffPreviewReliable; } catch {}
    return true;
  }

  function install() {
    const bottomReady = ensureBottomDivisionButton();
    const previewReady = installReliableRefreshButton();
    return bottomReady && previewReady;
  }

  install();
  let attempts = 0;
  const timer = setInterval(() => {
    const ready = install();
    attempts += 1;
    if (ready || attempts > 100) clearInterval(timer);
  }, 100);
})();
