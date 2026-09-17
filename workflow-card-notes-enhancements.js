(() => {
  // Proposal dashboard issue summary + selectable Internal Notes divisions.
  // Loaded after scope-workflow-tools-safe.js; avoids observers and only hooks
  // existing render/save functions.
  if (typeof state === 'undefined') return;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const textOf = (html = '') => {
    const div = document.createElement('div');
    div.innerHTML = String(html || '');
    return String(div.innerText || div.textContent || '').trim();
  };
  const divisionTitle = (project, number) => {
    const custom = String(project?.divisions?.[number]?.title || '').trim();
    if (custom) return custom;
    const row = (typeof CSI_DIVISIONS !== 'undefined' ? CSI_DIVISIONS : []).find(([n]) => n === number);
    return row?.[1] || '';
  };

  const style = document.createElement('style');
  style.textContent = `
    .project-issue-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-top:12px;padding:10px 0;border-top:1px solid #e8eaec;border-bottom:1px solid #eef0f1}
    .project-issue-summary-item{min-width:0}
    .project-issue-summary-item span{display:block;color:#8a8f93;font-size:8px;font-weight:800;letter-spacing:.055em;text-transform:uppercase;margin-bottom:3px}
    .project-issue-summary-item strong{display:block;color:#3b4044;font-size:11px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .internal-notes-add-row{display:flex;align-items:center;gap:8px;flex:1;min-width:0}
    .internal-notes-add-row select{width:min(390px,100%);min-width:220px;padding:9px 11px;border:1px solid #d6dadd;border-radius:8px;background:#fff;color:#303539;font:500 12px/1.3 Inter,sans-serif}
    .internal-note-head{justify-content:flex-start}
    .internal-note-head strong{flex:1;min-width:0}
    .internal-note-remove{margin-left:auto;flex:0 0 auto}
    .internal-notes-empty{padding:28px 18px;border:1px dashed #cfd4d8;border-radius:10px;background:#fbfbfb;color:#72777b;font-size:12px;line-height:1.45;text-align:center}
    @media(max-width:700px){.project-issue-summary{grid-template-columns:1fr}.internal-notes-add-row{align-items:stretch;flex-direction:column}.internal-notes-add-row select{width:100%;min-width:0}}
  `;
  document.head.appendChild(style);

  function issueHistoryFor(project, ownerUsername) {
    if (!project) return [];
    const familyId = project.familyId || project.id;
    const projects = typeof getProjectsForUser === 'function'
      ? getProjectsForUser(ownerUsername, { includeDeleted: true })
      : [project];
    const seen = new Map();
    projects.filter(p => (p.familyId || p.id) === familyId).forEach(p => {
      (Array.isArray(p.issueHistory) ? p.issueHistory : []).forEach(issue => {
        if (!issue) return;
        const key = issue.id || `${issue.date || ''}:${issue.createdAt || ''}:${issue.amount || ''}`;
        seen.set(key, issue);
      });
    });
    return [...seen.values()].sort((a, b) => {
      const av = String(a.date || a.createdAt || '');
      const bv = String(b.date || b.createdAt || '');
      return bv.localeCompare(av);
    });
  }

  function displayIssueDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '—';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatIssueAmount(value, project) {
    let raw = String(value || '').trim();
    if (!raw) {
      const base = (project?.priceItems || []).find(item => item?.isBaseBid || String(item?.name || '').trim().toLowerCase() === 'base bid');
      raw = String(base?.price || '').trim();
    }
    if (!raw) return '—';
    try {
      if (typeof window.formatKoehnCurrencyValue === 'function') return window.formatKoehnCurrencyValue(raw);
    } catch {}
    return raw;
  }

  function enhanceProjectIssueCards() {
    document.querySelectorAll('.project-card').forEach(card => {
      const open = card.querySelector('[data-open-project]');
      const projectId = open?.dataset.openProject;
      const ownerUsername = open?.dataset.owner || state.user?.username || '';
      if (!projectId || !ownerUsername || typeof getProjectsForUser !== 'function') return;
      const project = getProjectsForUser(ownerUsername, { includeDeleted: true }).find(p => p.id === projectId);
      if (!project) return;
      const issue = issueHistoryFor(project, ownerUsername)[0];
      const existing = card.querySelector('.project-issue-summary');
      if (!issue) {
        existing?.remove();
        return;
      }
      const html = `<div class="project-issue-summary-item"><span>Latest Issue</span><strong>${esc(displayIssueDate(issue.date || issue.createdAt))}${issue.revisionLabel ? ` · ${esc(issue.revisionLabel)}` : ''}</strong></div><div class="project-issue-summary-item"><span>Base Bid</span><strong>${esc(formatIssueAmount(issue.amount, project))}</strong></div>`;
      let strip = existing;
      if (!strip) {
        strip = document.createElement('div');
        strip.className = 'project-issue-summary';
        const meta = card.querySelector('.project-meta');
        if (meta) card.insertBefore(strip, meta); else card.appendChild(strip);
      }
      strip.innerHTML = html;
    });
  }

  if (typeof renderProjects === 'function' && !renderProjects.__issueCardEnhancement) {
    const originalRenderProjects = renderProjects;
    const wrappedRenderProjects = function() {
      const result = originalRenderProjects.apply(this, arguments);
      enhanceProjectIssueCards();
      return result;
    };
    wrappedRenderProjects.__issueCardEnhancement = true;
    renderProjects = wrappedRenderProjects;
    window.renderProjects = wrappedRenderProjects;
  }

  function selectedInternalDivisions(project) {
    project.internalNotes = project.internalNotes || {};
    project.internalNotes.divisions = project.internalNotes.divisions || {};
    if (Array.isArray(project.internalNotes.selectedDivisions)) {
      return project.internalNotes.selectedDivisions.map(String);
    }
    // Migration for notes created before selectable divisions existed: only show
    // divisions that already contain note text.
    return Object.entries(project.internalNotes.divisions)
      .filter(([, note]) => {
        if (note && typeof note === 'object') return Boolean(String(note.text || '').trim() || textOf(note.richText || ''));
        return Boolean(String(note || '').trim());
      })
      .map(([number]) => String(number));
  }

  function snapshotInternalNotes(project) {
    if (!project) return project;
    project.internalNotes = project.internalNotes || {};
    project.internalNotes.divisions = project.internalNotes.divisions || {};
    document.querySelectorAll('#internalNotesList [data-internal-note]').forEach(el => {
      const number = String(el.dataset.internalNote || '');
      const text = String(el.value || '').replace(/\r/g, '');
      project.internalNotes.divisions[number] = {
        text,
        richText: text ? text.split('\n').map(line => `<div>${esc(line) || '<br>'}</div>`).join('') : ''
      };
    });
    return project;
  }

  function currentProjectSnapshot() {
    let project = null;
    try {
      if (typeof collectEditorProject === 'function') project = collectEditorProject();
    } catch {}
    project = project || (typeof getCurrentProject === 'function' ? getCurrentProject() : null);
    return snapshotInternalNotes(project);
  }

  function saveProjectImmediately(project) {
    if (!project) return;
    try {
      if (typeof putProject === 'function') putProject(project, state.currentProjectOwner || state.user?.username);
    } catch (error) {
      console.warn('Internal note division selection save failed.', error);
    }
  }

  function ensureInternalNotesControls(project) {
    const panel = document.getElementById('internalTab');
    const tools = panel?.querySelector('.internal-notes-tools');
    if (!panel || !tools || !project) return;

    let addRow = tools.querySelector('.internal-notes-add-row');
    if (!addRow) {
      // Replace the old search-first toolbar with division selection first; keep
      // search available beside it for projects with several note divisions.
      addRow = document.createElement('div');
      addRow.className = 'internal-notes-add-row';
      addRow.innerHTML = `<select id="internalNotesDivisionSelect" aria-label="Select an internal notes division"></select><button id="addInternalNotesDivisionBtn" class="btn btn-primary btn-small" type="button">+ Add Division</button>`;
      tools.insertBefore(addRow, tools.firstChild);
      const search = tools.querySelector('#internalNotesSearch');
      if (search) search.placeholder = 'Search added divisions';
      addRow.querySelector('#addInternalNotesDivisionBtn')?.addEventListener('click', addInternalNoteDivision);
    }
    refreshInternalDivisionDropdown(project);
  }

  function refreshInternalDivisionDropdown(project) {
    const select = document.getElementById('internalNotesDivisionSelect');
    if (!select || !project) return;
    const selected = new Set(selectedInternalDivisions(project));
    const divisions = typeof CSI_DIVISIONS !== 'undefined' ? CSI_DIVISIONS : [];
    const available = divisions.filter(([number]) => !selected.has(String(number)));
    select.innerHTML = available.length
      ? `<option value="">Select division…</option>${available.map(([number, title]) => `<option value="${esc(number)}">Division ${esc(number)} - ${esc(divisionTitle(project, number) || title)}</option>`).join('')}`
      : '<option value="">All divisions added</option>';
    select.disabled = !available.length;
    const button = document.getElementById('addInternalNotesDivisionBtn');
    if (button) button.disabled = !available.length || Boolean(project.locked || project.deletedByUser);
  }

  function renderSelectedInternalNotes(project) {
    const list = document.getElementById('internalNotesList');
    if (!list || !project) return;
    project.internalNotes = project.internalNotes || {};
    project.internalNotes.divisions = project.internalNotes.divisions || {};
    const selected = selectedInternalDivisions(project);
    const order = new Map((typeof CSI_DIVISIONS !== 'undefined' ? CSI_DIVISIONS : []).map(([n], index) => [String(n), index]));
    selected.sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
    project.internalNotes.selectedDivisions = [...selected];
    const locked = Boolean(project.locked || project.deletedByUser);

    if (!selected.length) {
      list.innerHTML = '<div class="internal-notes-empty">No internal-note divisions added yet.<br>Select a division above and click <strong>+ Add Division</strong>.</div>';
      refreshInternalDivisionDropdown(project);
      return;
    }

    list.innerHTML = selected.map(number => {
      const note = project.internalNotes.divisions[number] || {};
      const value = note && typeof note === 'object' ? String(note.text || textOf(note.richText || '')) : String(note || '');
      return `<section class="internal-note-card ${value.trim() ? 'has-note' : ''}" data-note-card="${esc(number)}"><div class="internal-note-head"><span class="internal-note-num">${esc(number)}</span><strong>Division ${esc(number)} - ${esc(divisionTitle(project, number))}</strong><button class="text-btn internal-note-remove" type="button" data-remove-internal-note-division="${esc(number)}" ${locked ? 'disabled' : ''}>Remove</button></div><textarea data-internal-note="${esc(number)}" ${locked ? 'disabled' : ''} placeholder="Internal notes for Division ${esc(number)}…">${esc(value)}</textarea></section>`;
    }).join('');
    refreshInternalDivisionDropdown(project);
  }

  function enhanceInternalNotesPanel(project = null) {
    const panel = document.getElementById('internalTab');
    if (!panel) return;
    project = project || (typeof getCurrentProject === 'function' ? getCurrentProject() : null);
    if (!project) return;
    ensureInternalNotesControls(project);
    renderSelectedInternalNotes(project);
    if (panel.dataset.selectableDivisionsBound !== '1') {
      panel.dataset.selectableDivisionsBound = '1';
      panel.addEventListener('click', event => {
        const remove = event.target?.closest?.('[data-remove-internal-note-division]');
        if (!remove) return;
        removeInternalNoteDivision(remove.dataset.removeInternalNoteDivision);
      });
    }
  }

  function addInternalNoteDivision() {
    const select = document.getElementById('internalNotesDivisionSelect');
    const number = String(select?.value || '').trim();
    if (!number) return;
    const project = currentProjectSnapshot();
    if (!project || project.locked || project.deletedByUser) return;
    project.internalNotes = project.internalNotes || {};
    project.internalNotes.divisions = project.internalNotes.divisions || {};
    const selected = new Set(selectedInternalDivisions(project));
    selected.add(number);
    project.internalNotes.selectedDivisions = [...selected];
    if (!project.internalNotes.divisions[number]) project.internalNotes.divisions[number] = { text: '', richText: '' };
    saveProjectImmediately(project);
    renderSelectedInternalNotes(project);
    const textarea = document.querySelector(`#internalNotesList [data-internal-note="${CSS.escape(number)}"]`);
    textarea?.focus();
  }

  function removeInternalNoteDivision(number) {
    const project = currentProjectSnapshot();
    if (!project || project.locked || project.deletedByUser) return;
    const selected = new Set(selectedInternalDivisions(project));
    selected.delete(String(number));
    // Keep the note data in the project so removing/re-adding a division doesn't
    // destroy an estimator's notes.
    project.internalNotes.selectedDivisions = [...selected];
    saveProjectImmediately(project);
    renderSelectedInternalNotes(project);
  }

  // Preserve selected division choices whenever the normal project save runs.
  if (typeof collectEditorProject === 'function' && !collectEditorProject.__selectedInternalDivisions) {
    const originalCollect = collectEditorProject;
    const wrappedCollect = function() {
      const project = originalCollect.apply(this, arguments);
      if (!project) return project;
      project.internalNotes = project.internalNotes || {};
      const visible = [...document.querySelectorAll('#internalNotesList [data-internal-note]')].map(el => String(el.dataset.internalNote || ''));
      if (document.getElementById('internalTab')) project.internalNotes.selectedDivisions = visible;
      return project;
    };
    wrappedCollect.__selectedInternalDivisions = true;
    collectEditorProject = wrappedCollect;
    window.collectEditorProject = wrappedCollect;
  }

  // Run after the safe workflow layer populates its tabs.
  if (typeof populateEditor === 'function' && !populateEditor.__selectedInternalDivisions) {
    const originalPopulate = populateEditor;
    const wrappedPopulate = function(project) {
      const result = originalPopulate.apply(this, arguments);
      queueMicrotask(() => enhanceInternalNotesPanel(project));
      return result;
    };
    wrappedPopulate.__selectedInternalDivisions = true;
    populateEditor = wrappedPopulate;
    window.populateEditor = wrappedPopulate;
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#editorView [data-tab="internal"]')) {
      // The safe workflow tab handler renders all divisions first; replace it
      // immediately afterward with the user's selected divisions only.
      queueMicrotask(() => enhanceInternalNotesPanel());
    }
  });

  enhanceProjectIssueCards();
  queueMicrotask(() => enhanceInternalNotesPanel());
  window.enhanceProjectIssueCards = enhanceProjectIssueCards;
})();