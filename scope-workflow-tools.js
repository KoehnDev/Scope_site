(() => {
  // Scope workflow tools — Internal Notes, Issue History, Revision Comparison,
  // Proposal -> Kickoff prefill, and expanded Kickoff proposal references.
  if (typeof state === 'undefined' || typeof normalizeProject !== 'function') {
    console.warn('Scope workflow tools skipped: core project functions are unavailable.');
    return;
  }

  const PATCH_VERSION = '2026-09-17-1';
  const SPECIAL_PREFIX = '__koehn_ref__:';

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const stripHtml = (html = '') => {
    const div = document.createElement('div');
    div.innerHTML = String(html || '');
    return String(div.innerText || div.textContent || '').replace(/\r/g, '').trim();
  };
  const asPlain = (rich, plain) => stripHtml(rich) || String(plain || '').trim();
  const asRich = (rich, plain) => {
    const html = String(rich || '').trim();
    if (html) return typeof sanitizeScopeHtml === 'function' ? sanitizeScopeHtml(html) : html;
    const text = String(plain || '').replace(/\r/g, '');
    return text ? text.split('\n').map(line => `<div>${escapeHtml(line) || '<br>'}</div>`).join('') : '';
  };
  const isBlank = value => !String(value ?? '').trim();
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const moneyFromProject = project => {
    const base = (project?.priceItems || []).find(item => item?.isBaseBid || String(item?.name || '').trim().toLowerCase() === 'base bid');
    return String(base?.price || '');
  };
  const divisionTitle = (number, project = null) => {
    const custom = project?.divisions?.[number]?.title;
    if (String(custom || '').trim()) return String(custom).trim();
    const found = (typeof CSI_DIVISIONS !== 'undefined' ? CSI_DIVISIONS : []).find(([n]) => n === number);
    return found?.[1] || '';
  };
  const projectOwner = () => state.currentProjectOwner || state.user?.username || '';

  function ensureWorkflowData(project) {
    if (!project) return project;
    project.internalNotes = project.internalNotes && typeof project.internalNotes === 'object' ? project.internalNotes : {};
    project.internalNotes.divisions = project.internalNotes.divisions && typeof project.internalNotes.divisions === 'object' ? project.internalNotes.divisions : {};
    (typeof CSI_DIVISIONS !== 'undefined' ? CSI_DIVISIONS : []).forEach(([number]) => {
      const existing = project.internalNotes.divisions[number];
      if (existing && typeof existing === 'object') {
        project.internalNotes.divisions[number] = {
          text: String(existing.text || ''),
          richText: String(existing.richText || '')
        };
      } else {
        project.internalNotes.divisions[number] = { text: String(existing || ''), richText: '' };
      }
    });
    project.issueHistory = Array.isArray(project.issueHistory) ? project.issueHistory.map(entry => ({ ...entry })) : [];
    project.kickoff = { ...(project.kickoff || {}) };
    project.kickoff.projectInfo = { ...(project.kickoff.projectInfo || {}) };
    project.kickoff.proposalPrefillApplied = Boolean(project.kickoff.proposalPrefillApplied);
    return project;
  }

  if (!normalizeProject.__scopeWorkflowTools) {
    const originalNormalizeProject = normalizeProject;
    const wrappedNormalizeProject = function(project, ownerUsername = '') {
      return ensureWorkflowData(originalNormalizeProject.apply(this, arguments));
    };
    wrappedNormalizeProject.__scopeWorkflowTools = true;
    normalizeProject = wrappedNormalizeProject;
    window.normalizeProject = wrappedNormalizeProject;
  }

  const style = document.createElement('style');
  style.textContent = `
    .workflow-tab-note{color:#767b80;font-size:12px;line-height:1.45;margin:4px 0 0}
    .internal-notes-toolbar{display:flex;align-items:center;gap:10px;justify-content:space-between;margin:0 0 12px}
    .internal-notes-toolbar input{width:min(340px,100%);padding:10px 12px;border:1px solid #d6dadd;border-radius:9px;background:#fff}
    .internal-notes-list{display:grid;gap:12px}
    .internal-note-card{border:1px solid #d9dde1;border-radius:12px;background:#fff;overflow:hidden}
    .internal-note-card-head{display:flex;align-items:center;gap:10px;padding:11px 13px;border-bottom:1px solid #e4e7e9;background:#fafafa}
    .internal-note-number{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:28px;padding:0 8px;border-radius:7px;background:#fff1e8;color:#c95413;font-size:11px;font-weight:800}
    .internal-note-card-head strong{font-size:13px;color:#34383c}
    .internal-note-card textarea{width:100%;box-sizing:border-box;border:0;resize:vertical;min-height:92px;padding:12px 13px;font:400 13px/1.45 Inter,sans-serif;color:#252a2e;outline:none}
    .internal-note-card.has-note{border-color:#efb58e;box-shadow:0 0 0 1px rgba(243,111,33,.05)}
    .history-revision-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.35fr);gap:16px;align-items:start}
    .workflow-card{border:1px solid #d9dde1;border-radius:12px;background:#fff;padding:16px}
    .workflow-card h3{margin:0 0 4px;font-size:15px;color:#33383c}
    .workflow-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
    .issue-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .issue-form-grid label{display:grid;gap:5px;color:#555b60;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
    .issue-form-grid .full{grid-column:1/-1}
    .issue-form-grid input,.issue-form-grid textarea,.revision-compare-select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #d6dadd;border-radius:8px;background:#fff;color:#252a2e;font:500 12px/1.35 Inter,sans-serif}
    .issue-form-actions{display:flex;justify-content:flex-end;margin-top:10px}
    .issue-history-list{display:grid;gap:8px;margin-top:14px}
    .issue-history-item{border:1px solid #e0e3e5;border-radius:9px;padding:10px 11px;background:#fafafa}
    .issue-history-item-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .issue-history-item strong{font-size:12px;color:#33383c}
    .issue-history-meta{display:flex;flex-wrap:wrap;gap:6px 12px;color:#71767b;font-size:10px;margin-top:4px}
    .issue-history-notes{margin-top:7px;color:#4a4f53;font-size:11px;white-space:pre-wrap}
    .revision-compare-controls{display:flex;align-items:center;gap:9px;margin:0 0 12px}
    .revision-compare-controls label{font-size:10px;font-weight:800;color:#555b60;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
    .revision-compare-empty{padding:24px 15px;border:1px dashed #cfd4d8;border-radius:10px;text-align:center;color:#73787d;font-size:12px}
    .revision-change-list{display:grid;gap:10px}
    .revision-change{border:1px solid #e0e3e5;border-radius:10px;overflow:hidden;background:#fff}
    .revision-change summary{cursor:pointer;list-style:none;padding:10px 12px;background:#fafafa;font-size:12px;font-weight:800;color:#34383c;display:flex;align-items:center;justify-content:space-between;gap:8px}
    .revision-change summary::-webkit-details-marker{display:none}
    .revision-change-badge{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#c95413;background:#fff1e8;border-radius:999px;padding:4px 7px;white-space:nowrap}
    .revision-columns{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid #e6e8ea}
    .revision-column{padding:11px 12px;min-width:0}
    .revision-column+ .revision-column{border-left:1px solid #e6e8ea}
    .revision-column span{display:block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#858a8e;margin-bottom:6px}
    .revision-column pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:400 11px/1.45 Inter,sans-serif;color:#34383c}
    .kickoff-reference-workflow-note{margin-top:7px!important;color:#767b80!important}
    .kickoff-reference-workflow-source{font-weight:600}
    @media (max-width:980px){.history-revision-grid{grid-template-columns:1fr}}
    @media (max-width:700px){.issue-form-grid{grid-template-columns:1fr}.revision-columns{grid-template-columns:1fr}.revision-column+.revision-column{border-left:0;border-top:1px solid #e6e8ea}.internal-notes-toolbar{align-items:stretch;flex-direction:column}}
  `;
  document.head.appendChild(style);

  function ensureEditorWorkflowTabs() {
    const tabs = document.querySelector('#editorView .workspace-tabs');
    if (!tabs) return false;

    if (!tabs.querySelector('[data-tab="internal"]')) {
      const button = document.createElement('button');
      button.className = 'tab-btn';
      button.dataset.tab = 'internal';
      button.type = 'button';
      button.textContent = 'Internal Notes';
      const closeout = tabs.querySelector('[data-tab="closeout"]');
      if (closeout) tabs.insertBefore(button, closeout); else tabs.appendChild(button);
      button.addEventListener('click', () => {
        if (typeof activateTab === 'function') activateTab('internal');
        renderInternalNotes(getCurrentProject?.());
      });
    }

    if (!tabs.querySelector('[data-tab="history"]')) {
      const button = document.createElement('button');
      button.className = 'tab-btn';
      button.dataset.tab = 'history';
      button.type = 'button';
      button.textContent = 'History & Revisions';
      const company = tabs.querySelector('[data-tab="company"]');
      if (company) tabs.insertBefore(button, company); else tabs.appendChild(button);
      button.addEventListener('click', () => {
        if (typeof activateTab === 'function') activateTab('history');
        renderHistoryAndRevision(getCurrentProject?.());
      });
    }

    const workspace = document.querySelector('#editorView .editor-workspace');
    if (workspace && !document.getElementById('internalTab')) {
      const panel = document.createElement('div');
      panel.id = 'internalTab';
      panel.className = 'tab-panel';
      panel.innerHTML = `
        <div class="section-heading">
          <div><h2>Internal Notes by Division</h2><p>Estimator / operations notes only. These notes never print on the client proposal and remain available as references when the project moves to Kickoff.</p></div>
        </div>
        <div class="internal-notes-toolbar"><input id="internalNotesSearch" type="search" placeholder="Find a division or note" /><span class="workflow-tab-note">Autosaved with the project · Not client-facing</span></div>
        <div id="internalNotesList" class="internal-notes-list"></div>`;
      const scopePanel = document.getElementById('scopeTab');
      if (scopePanel?.nextSibling) workspace.insertBefore(panel, scopePanel.nextSibling); else workspace.appendChild(panel);
      panel.addEventListener('input', event => {
        if (!event.target?.matches?.('[data-internal-note-division]')) return;
        event.target.closest('.internal-note-card')?.classList.toggle('has-note', Boolean(String(event.target.value || '').trim()));
        if (typeof scheduleSave === 'function') scheduleSave();
      });
      panel.querySelector('#internalNotesSearch')?.addEventListener('input', filterInternalNotes);
    }

    if (workspace && !document.getElementById('historyTab')) {
      const panel = document.createElement('div');
      panel.id = 'historyTab';
      panel.className = 'tab-panel';
      panel.innerHTML = `
        <div class="section-heading">
          <div><h2>Proposal History & Revision Comparison</h2><p>Keep a record of proposals issued to the client and review exactly what changed between revisions.</p></div>
        </div>
        <div class="history-revision-grid">
          <section class="workflow-card">
            <div class="workflow-card-head"><div><h3>Proposal Issue History</h3><p class="workflow-tab-note">Records are internal and do not print on the proposal.</p></div></div>
            <div class="issue-form-grid">
              <label>Date Issued<input id="issueHistoryDate" type="date" /></label>
              <label>Revision<input id="issueHistoryRevision" readonly /></label>
              <label class="full">Sent To<input id="issueHistoryRecipient" placeholder="Client contact / email" /></label>
              <label>Proposal Amount<input id="issueHistoryAmount" placeholder="$0" /></label>
              <label>Issued By<input id="issueHistoryIssuedBy" placeholder="Estimator" /></label>
              <label class="full">Notes<textarea id="issueHistoryNotes" rows="3" placeholder="Optional issue notes, delivery method, requested follow-up, etc."></textarea></label>
            </div>
            <div class="issue-form-actions"><button id="recordProposalIssueBtn" class="btn btn-primary" type="button">Record Issue</button></div>
            <div id="issueHistoryList" class="issue-history-list"></div>
          </section>
          <section class="workflow-card">
            <div class="workflow-card-head"><div><h3>Revision Comparison</h3><p class="workflow-tab-note">Changed items only. Compare the current version with any earlier version in this project family.</p></div></div>
            <div class="revision-compare-controls"><label for="revisionCompareSelect">Compare To</label><select id="revisionCompareSelect" class="revision-compare-select"></select></div>
            <div id="revisionCompareResults"></div>
          </section>
        </div>`;
      const summaryPanel = document.getElementById('summaryTab');
      if (summaryPanel?.nextSibling) workspace.insertBefore(panel, summaryPanel.nextSibling); else workspace.appendChild(panel);
      panel.querySelector('#recordProposalIssueBtn')?.addEventListener('click', recordProposalIssue);
      panel.querySelector('#revisionCompareSelect')?.addEventListener('change', () => renderRevisionComparison(getCurrentProject?.()));
      panel.addEventListener('click', event => {
        const remove = event.target?.closest?.('[data-remove-issue]');
        if (remove) removeIssueHistoryRecord(remove.dataset.removeIssue);
      });
    }
    return true;
  }

  function renderInternalNotes(project) {
    const list = document.getElementById('internalNotesList');
    if (!list || !project) return;
    project = ensureWorkflowData(project);
    const locked = Boolean(project.locked || project.deletedByUser);
    const divisions = typeof CSI_DIVISIONS !== 'undefined' ? CSI_DIVISIONS : [];
    list.innerHTML = divisions.map(([number, defaultTitle]) => {
      const note = project.internalNotes.divisions[number] || { text: '', richText: '' };
      const text = String(note.text || stripHtml(note.richText || ''));
      const title = divisionTitle(number, project) || defaultTitle;
      return `<section class="internal-note-card ${text.trim() ? 'has-note' : ''}" data-internal-note-card="${escapeHtml(number)}">
        <div class="internal-note-card-head"><span class="internal-note-number">${escapeHtml(number)}</span><strong>${escapeHtml(title)}</strong></div>
        <textarea data-internal-note-division="${escapeHtml(number)}" placeholder="Internal notes for Division ${escapeHtml(number)}…" ${locked ? 'disabled' : ''}>${escapeHtml(text)}</textarea>
      </section>`;
    }).join('');
    filterInternalNotes();
  }

  function filterInternalNotes() {
    const query = String(document.getElementById('internalNotesSearch')?.value || '').trim().toLowerCase();
    document.querySelectorAll('#internalNotesList [data-internal-note-card]').forEach(card => {
      const haystack = `${card.textContent || ''} ${card.querySelector('textarea')?.value || ''}`.toLowerCase();
      card.classList.toggle('hidden', Boolean(query && !haystack.includes(query)));
    });
  }

  function collectInternalNotes(project) {
    if (!project) return project;
    ensureWorkflowData(project);
    document.querySelectorAll('#internalNotesList [data-internal-note-division]').forEach(textarea => {
      const number = String(textarea.dataset.internalNoteDivision || '');
      const text = String(textarea.value || '').replace(/\r/g, '');
      project.internalNotes.divisions[number] = { text, richText: text ? text.split('\n').map(line => `<div>${escapeHtml(line) || '<br>'}</div>`).join('') : '' };
    });
    return project;
  }

  if (typeof collectEditorProject === 'function' && !collectEditorProject.__scopeWorkflowTools) {
    const originalCollectEditorProject = collectEditorProject;
    const wrappedCollectEditorProject = function() {
      const project = originalCollectEditorProject.apply(this, arguments);
      return collectInternalNotes(ensureWorkflowData(project));
    };
    wrappedCollectEditorProject.__scopeWorkflowTools = true;
    collectEditorProject = wrappedCollectEditorProject;
    window.collectEditorProject = wrappedCollectEditorProject;
  }

  function formatIssueAmount(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (typeof window.formatKoehnCurrencyValue === 'function') return window.formatKoehnCurrencyValue(raw);
    if (typeof moneyNumber === 'function' && typeof formatMoneyNumber === 'function') return formatMoneyNumber(moneyNumber(raw));
    return raw;
  }

  function familyIssueHistory(project) {
    if (!project) return [];
    const owner = project.ownerUsername || projectOwner();
    const familyId = project.familyId || project.id;
    const family = typeof familyProjects === 'function' ? familyProjects(owner, familyId, { includeDeleted: true }) : [project];
    const all = [];
    family.forEach(version => (version.issueHistory || []).forEach(entry => all.push(entry)));
    const dedup = new Map();
    all.forEach(entry => { if (entry?.id) dedup.set(entry.id, entry); });
    return [...dedup.values()].sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
  }

  function saveFamilyIssueHistory(project, history) {
    if (!project) return;
    const owner = project.ownerUsername || projectOwner();
    const familyId = project.familyId || project.id;
    const all = getProjectsForUser(owner, { includeDeleted: true });
    const stamp = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();
    const updated = all.map(raw => (raw.familyId || raw.id) === familyId ? { ...raw, issueHistory: history.map(entry => ({ ...entry })), updatedAt: stamp } : raw);
    saveProjectsForUser(owner, updated);
  }

  function renderIssueHistory(project) {
    if (!project) return;
    const date = document.getElementById('issueHistoryDate');
    const revision = document.getElementById('issueHistoryRevision');
    const recipient = document.getElementById('issueHistoryRecipient');
    const amount = document.getElementById('issueHistoryAmount');
    const issuedBy = document.getElementById('issueHistoryIssuedBy');
    const button = document.getElementById('recordProposalIssueBtn');
    if (date && !date.value) date.value = todayIso();
    if (revision) revision.value = typeof versionLabel === 'function' ? versionLabel(project) : (Number(project.version || 0) ? `V${project.version}` : 'Original');
    if (recipient && !recipient.value) recipient.value = project.attention || project.clientName || '';
    if (amount && !amount.value) amount.value = formatIssueAmount(moneyFromProject(project));
    if (issuedBy && !issuedBy.value) issuedBy.value = project.preparedBy || state.user?.displayName || state.user?.username || '';
    if (button) button.disabled = Boolean(project.locked || project.deletedByUser);

    const list = document.getElementById('issueHistoryList');
    if (!list) return;
    const history = familyIssueHistory(project);
    if (!history.length) {
      list.innerHTML = '<div class="revision-compare-empty">No proposal issues recorded yet.</div>';
      return;
    }
    list.innerHTML = history.map(entry => `<div class="issue-history-item">
      <div class="issue-history-item-top"><div><strong>${escapeHtml(entry.revisionLabel || 'Proposal')} · ${escapeHtml(entry.date || '')}</strong><div class="issue-history-meta"><span>${escapeHtml(entry.recipient || 'Recipient not entered')}</span>${entry.amount ? `<span>${escapeHtml(entry.amount)}</span>` : ''}${entry.issuedBy ? `<span>Issued by ${escapeHtml(entry.issuedBy)}</span>` : ''}</div></div><button class="text-btn" type="button" data-remove-issue="${escapeHtml(entry.id || '')}">Remove</button></div>
      ${entry.notes ? `<div class="issue-history-notes">${escapeHtml(entry.notes)}</div>` : ''}
    </div>`).join('');
  }

  function recordProposalIssue() {
    const project = typeof collectEditorProject === 'function' ? collectEditorProject() : getCurrentProject?.();
    if (!project || project.locked || project.deletedByUser) return;
    const date = String(document.getElementById('issueHistoryDate')?.value || todayIso());
    const recipient = String(document.getElementById('issueHistoryRecipient')?.value || '').trim();
    const amount = formatIssueAmount(document.getElementById('issueHistoryAmount')?.value || '');
    const issuedBy = String(document.getElementById('issueHistoryIssuedBy')?.value || '').trim();
    const notes = String(document.getElementById('issueHistoryNotes')?.value || '').trim();
    const history = familyIssueHistory(project);
    history.unshift({
      id: typeof uid === 'function' ? uid() : `${Date.now()}-${Math.random()}`,
      projectId: project.id,
      version: Number(project.version || 0),
      revisionLabel: typeof versionLabel === 'function' ? versionLabel(project) : (Number(project.version || 0) ? `V${project.version}` : 'Original'),
      date,
      recipient,
      amount,
      issuedBy,
      notes,
      createdAt: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
    });
    saveFamilyIssueHistory(project, history);
    const notesInput = document.getElementById('issueHistoryNotes');
    if (notesInput) notesInput.value = '';
    renderIssueHistory(getCurrentProject?.() || project);
    if (typeof toast === 'function') toast('Proposal issue recorded.');
  }

  function removeIssueHistoryRecord(id) {
    const project = getCurrentProject?.();
    if (!project || project.locked || project.deletedByUser || !id) return;
    const next = familyIssueHistory(project).filter(entry => entry.id !== id);
    saveFamilyIssueHistory(project, next);
    renderIssueHistory(getCurrentProject?.() || project);
    if (typeof toast === 'function') toast('Issue record removed.');
  }

  const compareValue = value => String(value ?? '').replace(/\r/g, '').trim();
  function changeEntry(label, before, after, type = 'Changed') {
    const a = compareValue(before), b = compareValue(after);
    if (a === b) return null;
    return { label, before: a || '—', after: b || '—', type };
  }

  function proposalChanges(before, after) {
    const changes = [];
    const fields = [
      ['Project Name', 'projectName'], ['Project Number', 'projectNumber'], ['Client / Owner', 'clientName'], ['Attention', 'attention'],
      ['Project Address', 'projectAddress'], ['Proposal Date', 'proposalDate'], ['Prepared By', 'preparedBy'], ['Document Title', 'documentTitle'], ['Intro / Proposal Note', 'introNote']
    ];
    fields.forEach(([label, key]) => { const c = changeEntry(label, before?.[key], after?.[key]); if (c) changes.push(c); });

    (typeof CSI_DIVISIONS !== 'undefined' ? CSI_DIVISIONS : []).forEach(([number]) => {
      const oldDiv = before?.divisions?.[number] || {};
      const newDiv = after?.divisions?.[number] || {};
      const oldText = asPlain(oldDiv.richText, oldDiv.text);
      const newText = asPlain(newDiv.richText, newDiv.text);
      const oldEnabled = oldDiv.enabled !== false && Boolean(oldDiv.enabled);
      const newEnabled = newDiv.enabled !== false && Boolean(newDiv.enabled);
      const titleChanged = compareValue(oldDiv.title) !== compareValue(newDiv.title);
      if (oldEnabled !== newEnabled || titleChanged || oldText !== newText) {
        const title = divisionTitle(number, after) || divisionTitle(number, before);
        changes.push({
          label: `Division ${number} - ${title}`,
          before: `${oldEnabled ? 'Included' : 'Not included'}${oldText ? `\n\n${oldText}` : ''}`,
          after: `${newEnabled ? 'Included' : 'Not included'}${newText ? `\n\n${newText}` : ''}`,
          type: !oldEnabled && newEnabled ? 'Added' : oldEnabled && !newEnabled ? 'Removed' : 'Changed'
        });
      }
    });

    [['Clarifications', 'clarifications'], ['Exclusions', 'exclusions']].forEach(([label, key]) => {
      const c = changeEntry(label, asPlain(before?.[`${key}RichText`], before?.[key]), asPlain(after?.[`${key}RichText`], after?.[key]));
      if (c) changes.push(c);
    });

    const oldAlts = new Map((before?.alternateScopes || []).map(alt => [alt.id || alt.title, alt]));
    const newAlts = new Map((after?.alternateScopes || []).map(alt => [alt.id || alt.title, alt]));
    new Set([...oldAlts.keys(), ...newAlts.keys()]).forEach(key => {
      const oldAlt = oldAlts.get(key), newAlt = newAlts.get(key);
      const oldText = oldAlt ? `${oldAlt.title || 'Alternate'}\n${asPlain(oldAlt.richText, oldAlt.text)}`.trim() : '';
      const newText = newAlt ? `${newAlt.title || 'Alternate'}\n${asPlain(newAlt.richText, newAlt.text)}`.trim() : '';
      if (oldText !== newText || Boolean(oldAlt?.enabled !== false) !== Boolean(newAlt?.enabled !== false)) {
        changes.push({ label: `Alternate - ${newAlt?.title || oldAlt?.title || 'Untitled'}`, before: oldText || '—', after: newText || '—', type: !oldAlt ? 'Added' : !newAlt ? 'Removed' : 'Changed' });
      }
    });

    const oldPrices = new Map((before?.priceItems || []).map(item => [item.id || `${item.name}:${item.description}`, item]));
    const newPrices = new Map((after?.priceItems || []).map(item => [item.id || `${item.name}:${item.description}`, item]));
    new Set([...oldPrices.keys(), ...newPrices.keys()]).forEach(key => {
      const oldItem = oldPrices.get(key), newItem = newPrices.get(key);
      const oldText = oldItem ? `${oldItem.name || ''}${oldItem.description ? ` - ${oldItem.description}` : ''}: ${oldItem.price || ''}` : '';
      const newText = newItem ? `${newItem.name || ''}${newItem.description ? ` - ${newItem.description}` : ''}: ${newItem.price || ''}` : '';
      if (oldText !== newText) changes.push({ label: `Pricing - ${newItem?.name || oldItem?.name || 'Item'}`, before: oldText || '—', after: newText || '—', type: !oldItem ? 'Added' : !newItem ? 'Removed' : 'Changed' });
    });
    return changes;
  }

  function renderRevisionComparison(project) {
    const select = document.getElementById('revisionCompareSelect');
    const results = document.getElementById('revisionCompareResults');
    if (!select || !results || !project) return;
    const owner = project.ownerUsername || projectOwner();
    const familyId = project.familyId || project.id;
    const versions = typeof familyProjects === 'function' ? familyProjects(owner, familyId, { includeDeleted: false }) : [project];
    const earlier = versions.filter(version => Number(version.version || 0) < Number(project.version || 0)).sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
    const previousSelection = select.value;
    select.innerHTML = earlier.length ? earlier.map(version => `<option value="${escapeHtml(version.id)}">${escapeHtml(typeof versionLabel === 'function' ? versionLabel(version) : `V${version.version || 0}`)}</option>`).join('') : '<option value="">No earlier revision</option>';
    if (earlier.some(version => version.id === previousSelection)) select.value = previousSelection;
    select.disabled = !earlier.length;
    if (!earlier.length) {
      results.innerHTML = '<div class="revision-compare-empty">Create a revision to begin comparing proposal changes.</div>';
      return;
    }
    const before = earlier.find(version => version.id === select.value) || earlier[0];
    const current = (typeof collectEditorProject === 'function' && !project.locked && !project.deletedByUser) ? collectEditorProject() : project;
    const changes = proposalChanges(before, current);
    if (!changes.length) {
      results.innerHTML = `<div class="revision-compare-empty">No proposal changes found between ${escapeHtml(typeof versionLabel === 'function' ? versionLabel(before) : 'earlier revision')} and ${escapeHtml(typeof versionLabel === 'function' ? versionLabel(current) : 'current revision')}.</div>`;
      return;
    }
    results.innerHTML = `<div class="revision-change-list">${changes.map((change, index) => `<details class="revision-change" ${index < 3 ? 'open' : ''}>
      <summary><span>${escapeHtml(change.label)}</span><span class="revision-change-badge">${escapeHtml(change.type)}</span></summary>
      <div class="revision-columns"><div class="revision-column"><span>${escapeHtml(typeof versionLabel === 'function' ? versionLabel(before) : 'Previous')}</span><pre>${escapeHtml(change.before)}</pre></div><div class="revision-column"><span>${escapeHtml(typeof versionLabel === 'function' ? versionLabel(current) : 'Current')}</span><pre>${escapeHtml(change.after)}</pre></div></div>
    </details>`).join('')}</div>`;
  }

  function renderHistoryAndRevision(project) {
    if (!project) return;
    renderIssueHistory(project);
    renderRevisionComparison(project);
  }

  if (typeof populateEditor === 'function' && !populateEditor.__scopeWorkflowTools) {
    const originalPopulateEditor = populateEditor;
    const wrappedPopulateEditor = function(project) {
      const result = originalPopulateEditor.apply(this, arguments);
      ensureEditorWorkflowTabs();
      const normalized = ensureWorkflowData(project);
      renderInternalNotes(normalized);
      renderHistoryAndRevision(normalized);
      return result;
    };
    wrappedPopulateEditor.__scopeWorkflowTools = true;
    populateEditor = wrappedPopulateEditor;
    window.populateEditor = wrappedPopulateEditor;
  }

  function applyProposalPrefillToFamily(projectId, ownerUsername) {
    const owner = ownerUsername || state.user?.username || '';
    if (!owner || !projectId) return;
    const all = getProjectsForUser(owner, { includeDeleted: true });
    const source = all.find(project => project.id === projectId);
    if (!source) return;
    const familyId = source.familyId || source.id;
    const sourceProject = ensureWorkflowData(normalizeProject({ ...source }, owner));
    const kickoff = typeof cloneJson === 'function' ? cloneJson(sourceProject.kickoff || {}) : JSON.parse(JSON.stringify(sourceProject.kickoff || {}));
    kickoff.projectInfo = { ...(kickoff.projectInfo || {}) };
    if (kickoff.proposalPrefillApplied) return;

    const info = kickoff.projectInfo;
    const fill = (key, value) => { if (isBlank(info[key]) && !isBlank(value)) info[key] = value; };
    fill('projectOverview', sourceProject.introNote || '');
    fill('owner', sourceProject.clientName || '');
    fill('ownerContacts', sourceProject.attention ? `Attention: ${sourceProject.attention}` : '');
    fill('projectLocation', sourceProject.projectAddress || '');
    fill('designTeam', sourceProject.preparedBy ? `Koehn Construction Services – ${sourceProject.preparedBy}` : '');
    fill('revenue', moneyFromProject(sourceProject));
    kickoff.proposalPrefillApplied = true;
    kickoff.proposalPrefillSourceId = sourceProject.id;
    kickoff.proposalPrefillAt = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

    const next = all.map(raw => (raw.familyId || raw.id) === familyId ? { ...raw, kickoff: typeof cloneJson === 'function' ? cloneJson(kickoff) : JSON.parse(JSON.stringify(kickoff)) } : raw);
    saveProjectsForUser(owner, next);
  }

  if (typeof openKickoff === 'function' && !openKickoff.__scopeWorkflowPrefill) {
    const originalOpenKickoff = openKickoff;
    const wrappedOpenKickoff = function(projectId, ownerUsername) {
      try { applyProposalPrefillToFamily(projectId, ownerUsername || state.user?.username); }
      catch (error) { console.warn('Proposal to Kickoff prefill failed.', error); }
      return originalOpenKickoff.apply(this, arguments);
    };
    wrappedOpenKickoff.__scopeWorkflowPrefill = true;
    openKickoff = wrappedOpenKickoff;
    window.openKickoff = wrappedOpenKickoff;
  }

  function workflowReferenceSources(project) {
    if (!project) return [];
    ensureWorkflowData(project);
    const sources = [];
    const clarifications = asRich(project.clarificationsRichText, project.clarifications);
    const exclusions = asRich(project.exclusionsRichText, project.exclusions);
    if (stripHtml(clarifications)) sources.push({ group: 'Proposal Qualifications', key: 'clarifications', label: 'Clarifications', title: 'Proposal Clarifications', html: clarifications });
    if (stripHtml(exclusions)) sources.push({ group: 'Proposal Qualifications', key: 'exclusions', label: 'Exclusions', title: 'Proposal Exclusions', html: exclusions });
    (project.alternateScopes || []).forEach((alt, index) => {
      if (alt?.enabled === false) return;
      const html = asRich(alt.richText, alt.text);
      if (!stripHtml(html)) return;
      const title = String(alt.title || `Alternate ${String(index + 1).padStart(2, '0')}`).trim();
      sources.push({ group: 'Proposal Alternates', key: `alternate:${alt.id || index}`, label: title, title: `Proposal Alternate - ${title}`, html });
    });
    (typeof CSI_DIVISIONS !== 'undefined' ? CSI_DIVISIONS : []).forEach(([number]) => {
      const note = project.internalNotes?.divisions?.[number] || {};
      const html = asRich(note.richText, note.text);
      if (!stripHtml(html)) return;
      sources.push({ group: 'Internal Notes', key: `internal:${number}`, label: `Division ${number} - ${divisionTitle(number, project)}`, title: `Internal Notes - Division ${number} - ${divisionTitle(number, project)}`, html });
    });
    return sources;
  }

  function sourceByValue(project, value) {
    const key = String(value || '').startsWith(SPECIAL_PREFIX) ? String(value).slice(SPECIAL_PREFIX.length) : '';
    return workflowReferenceSources(project).find(source => source.key === key) || null;
  }

  function enhanceKickoffReferenceSelectors() {
    const project = typeof getCurrentKickoffProject === 'function' ? getCurrentKickoffProject() : null;
    const list = document.getElementById('kickoffDivisionList');
    if (!project || !list) return false;
    const sources = workflowReferenceSources(project);
    list.querySelectorAll('[data-kickoff-proposal-reference-panel]').forEach(panel => {
      const headEyebrow = panel.querySelector('.kickoff-proposal-reference-head .eyebrow');
      if (headEyebrow) headEyebrow.textContent = 'Proposal & Internal References';
      const select = panel.querySelector('[data-kickoff-proposal-reference-select]');
      if (!select || select.dataset.workflowSourcesReady === 'true') return;
      const grouped = new Map();
      sources.forEach(source => {
        if (!grouped.has(source.group)) grouped.set(source.group, []);
        grouped.get(source.group).push(source);
      });
      grouped.forEach((items, group) => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = group;
        items.forEach(source => {
          const option = document.createElement('option');
          option.value = `${SPECIAL_PREFIX}${source.key}`;
          option.textContent = source.label;
          option.className = 'kickoff-reference-workflow-source';
          optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
      });
      select.dataset.workflowSourcesReady = 'true';
      const note = panel.querySelector('p');
      if (note) {
        note.classList.add('kickoff-reference-workflow-note');
        note.textContent = 'Reference-only. Proposal divisions, clarifications, exclusions, alternates, and internal division notes can be copied into the kickoff notes as needed.';
      }
    });
    return true;
  }

  function renderSpecialKickoffReference(select) {
    const project = typeof getCurrentKickoffProject === 'function' ? getCurrentKickoffProject() : null;
    const source = sourceByValue(project, select?.value);
    const card = select?.closest('.kickoff-division-card');
    if (!source || !card) return false;
    const title = card.querySelector('[data-kickoff-proposal-reference-title]');
    const preview = card.querySelector('[data-kickoff-proposal-reference-text]');
    if (title) title.textContent = source.title;
    if (preview) {
      preview.innerHTML = typeof sanitizeScopeHtml === 'function' ? sanitizeScopeHtml(source.html) : source.html;
      preview.classList.toggle('reference-empty', !stripHtml(source.html));
    }
    card.dataset.workflowReferenceSource = select.value;
    return true;
  }

  async function copySpecialKickoffReference(button) {
    const card = button.closest('.kickoff-division-card');
    const select = card?.querySelector('[data-kickoff-proposal-reference-select]');
    const project = typeof getCurrentKickoffProject === 'function' ? getCurrentKickoffProject() : null;
    const source = sourceByValue(project, select?.value);
    if (!source) return false;
    const text = stripHtml(source.html);
    try {
      if (navigator.clipboard?.write && window.ClipboardItem) {
        const htmlBlob = new Blob([source.html], { type: 'text/html' });
        const textBlob = new Blob([text], { type: 'text/plain' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      if (typeof toast === 'function') toast('Reference text copied.');
    } catch (error) {
      console.warn('Could not copy formatted reference text.', error);
      if (typeof toast === 'function') toast('Could not copy reference text. Select the text in the reference box instead.');
    }
    return true;
  }

  function bindKickoffReferenceEvents() {
    const list = document.getElementById('kickoffDivisionList');
    if (!list || list.dataset.workflowReferenceBound === 'true') return false;
    list.dataset.workflowReferenceBound = 'true';
    list.addEventListener('change', event => {
      const select = event.target?.closest?.('[data-kickoff-proposal-reference-select]');
      if (!select || !String(select.value || '').startsWith(SPECIAL_PREFIX)) return;
      event.stopImmediatePropagation();
      renderSpecialKickoffReference(select);
    }, true);
    list.addEventListener('click', event => {
      const button = event.target?.closest?.('[data-kickoff-copy-proposal-text]');
      if (!button) return;
      const select = button.closest('.kickoff-division-card')?.querySelector('[data-kickoff-proposal-reference-select]');
      if (!String(select?.value || '').startsWith(SPECIAL_PREFIX)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      copySpecialKickoffReference(button);
    }, true);
    return true;
  }

  const kickoffObserver = new MutationObserver(() => enhanceKickoffReferenceSelectors());
  const kickoffList = document.getElementById('kickoffDivisionList');
  if (kickoffList) kickoffObserver.observe(kickoffList, { childList: true, subtree: true });
  bindKickoffReferenceEvents();

  if (typeof renderKickoffDivisions === 'function' && !renderKickoffDivisions.__scopeWorkflowReferences) {
    const originalRenderKickoffDivisions = renderKickoffDivisions;
    const wrappedRenderKickoffDivisions = function() {
      const result = originalRenderKickoffDivisions.apply(this, arguments);
      queueMicrotask(() => { bindKickoffReferenceEvents(); enhanceKickoffReferenceSelectors(); });
      return result;
    };
    wrappedRenderKickoffDivisions.__scopeWorkflowReferences = true;
    renderKickoffDivisions = wrappedRenderKickoffDivisions;
    window.renderKickoffDivisions = wrappedRenderKickoffDivisions;
  }

  ensureEditorWorkflowTabs();
  const current = typeof getCurrentProject === 'function' ? getCurrentProject() : null;
  if (current) {
    renderInternalNotes(current);
    renderHistoryAndRevision(current);
  }
  enhanceKickoffReferenceSelectors();
  window.__scopeWorkflowToolsVersion = PATCH_VERSION;
  console.info(`Scope workflow tools loaded (${PATCH_VERSION}).`);
})();
