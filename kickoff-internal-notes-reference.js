(() => {
  // Kickoff division shortcut for proposal-side Internal Notes.
  // Reuses the existing proposal reference panel in a dedicated Notes mode.
  if (typeof state === 'undefined') return;

  const NOTE_PREFIX = '__koehn_note__:';
  const escHtml = (value = '') => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const plainText = (html = '') => {
    const div = document.createElement('div');
    div.innerHTML = String(html || '');
    return String(div.innerText || div.textContent || '').trim();
  };
  const noteHtml = note => {
    if (!note) return '';
    if (typeof note === 'string') {
      return typeof plainTextToRichHtml === 'function'
        ? plainTextToRichHtml(note)
        : String(note).split('\n').map(line => `<div>${escHtml(line) || '<br>'}</div>`).join('');
    }
    const rich = String(note.richText || '').trim();
    if (rich) return rich;
    const text = String(note.text || '');
    return typeof plainTextToRichHtml === 'function'
      ? plainTextToRichHtml(text)
      : text.split('\n').map(line => `<div>${escHtml(line) || '<br>'}</div>`).join('');
  };
  const currentProject = () => typeof getCurrentKickoffProject === 'function' ? getCurrentKickoffProject() : null;
  const divisionTitle = (project, number) => {
    const custom = String(project?.divisions?.[number]?.title || '').trim();
    if (custom) return custom;
    const row = (typeof CSI_DIVISIONS !== 'undefined' ? CSI_DIVISIONS : []).find(([n]) => String(n) === String(number));
    return row?.[1] || '';
  };
  const divisionNumberForCard = card => String(card?.querySelector('[data-kickoff-division-field="number"]')?.value || '').trim();

  function stripInternalNotesFromProposalOptions(html) {
    const select = document.createElement('select');
    select.innerHTML = String(html || '');
    [...select.querySelectorAll('optgroup')].forEach(group => {
      if (String(group.label || '').trim().toLowerCase() === 'internal notes') group.remove();
    });
    return select.innerHTML;
  }

  function notesOptionsHtml(project, selectedNumber) {
    const divisions = typeof CSI_DIVISIONS !== 'undefined' ? CSI_DIVISIONS : [];
    const known = new Map(divisions.map(([number, title]) => [String(number), String(title || '')]));
    Object.keys(project?.internalNotes?.divisions || {}).forEach(number => {
      if (!known.has(String(number))) known.set(String(number), divisionTitle(project, String(number)) || 'Custom Division');
    });
    if (selectedNumber && !known.has(String(selectedNumber))) known.set(String(selectedNumber), divisionTitle(project, String(selectedNumber)) || 'Custom Division');
    const order = [...known.entries()].sort((a, b) => {
      const ai = divisions.findIndex(([number]) => String(number) === a[0]);
      const bi = divisions.findIndex(([number]) => String(number) === b[0]);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a[0].localeCompare(b[0], undefined, { numeric: true });
    });
    return order.map(([number, fallbackTitle]) => {
      const title = divisionTitle(project, number) || fallbackTitle;
      const selected = String(number) === String(selectedNumber) ? ' selected' : '';
      return `<option value="${NOTE_PREFIX}${escHtml(number)}"${selected}>Division ${escHtml(number)} - ${escHtml(title)}</option>`;
    }).join('');
  }

  function renderNotesReference(card, value) {
    const project = currentProject();
    const panel = card?.querySelector('[data-kickoff-proposal-reference-panel]');
    if (!project || !panel) return;
    const raw = String(value || '');
    const number = raw.startsWith(NOTE_PREFIX) ? raw.slice(NOTE_PREFIX.length) : raw;
    const note = project.internalNotes?.divisions?.[number];
    const html = noteHtml(note);
    const text = plainText(html);
    const eyebrow = panel.querySelector('.kickoff-proposal-reference-head .eyebrow');
    const title = panel.querySelector('[data-kickoff-proposal-reference-title]');
    const preview = panel.querySelector('[data-kickoff-proposal-reference-text]');
    const help = panel.querySelector('p');
    if (eyebrow) eyebrow.textContent = 'Internal Notes Reference';
    if (title) title.textContent = `Internal Notes - Division ${number}${divisionTitle(project, number) ? ` - ${divisionTitle(project, number)}` : ''}`;
    if (preview) {
      if (text) {
        preview.innerHTML = typeof sanitizeScopeHtml === 'function' ? sanitizeScopeHtml(html) : html;
        preview.classList.remove('reference-empty');
      } else {
        preview.textContent = `No internal notes have been entered for Division ${number}.`;
        preview.classList.add('reference-empty');
      }
    }
    if (help) help.textContent = 'Internal-only reference. Select any division to review its notes, then copy only what you want into the Kickoff notes.';
  }

  function openNotesReference(card) {
    const project = currentProject();
    const panel = card?.querySelector('[data-kickoff-proposal-reference-panel]');
    const select = panel?.querySelector('[data-kickoff-proposal-reference-select]');
    if (!project || !panel || !select) return;

    if (panel.dataset.referenceMode !== 'notes') {
      select._koehnProposalOptionsHtml = stripInternalNotesFromProposalOptions(select.innerHTML);
      select._koehnProposalSelectedValue = select.value || '';
    }
    panel.dataset.referenceMode = 'notes';
    const currentNumber = divisionNumberForCard(card);
    select.innerHTML = notesOptionsHtml(project, currentNumber);
    const preferred = `${NOTE_PREFIX}${currentNumber}`;
    if ([...select.options].some(option => option.value === preferred)) select.value = preferred;
    renderNotesReference(card, select.value);
    panel.classList.remove('hidden');
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function restoreProposalReference(card) {
    const panel = card?.querySelector('[data-kickoff-proposal-reference-panel]');
    const select = panel?.querySelector('[data-kickoff-proposal-reference-select]');
    if (!panel || !select) return;

    const savedHtml = select._koehnProposalOptionsHtml;
    const savedValue = select._koehnProposalSelectedValue;
    if (savedHtml) select.innerHTML = stripInternalNotesFromProposalOptions(savedHtml);
    else {
      [...select.querySelectorAll('optgroup')].forEach(group => {
        if (String(group.label || '').trim().toLowerCase() === 'internal notes') group.remove();
      });
    }
    panel.dataset.referenceMode = 'proposal';
    const currentNumber = divisionNumberForCard(card);
    const preferred = [savedValue, currentNumber].find(value => value && [...select.options].some(option => option.value === value));
    if (preferred) select.value = preferred;
    else if (select.options.length) select.selectedIndex = 0;

    const eyebrow = panel.querySelector('.kickoff-proposal-reference-head .eyebrow');
    const help = panel.querySelector('p');
    if (eyebrow) eyebrow.textContent = 'Proposal References';
    if (help) help.textContent = 'Reference-only. Proposal divisions, clarifications, exclusions, and alternates can be copied into the Kickoff notes as needed.';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function enhanceNotesButtons() {
    const list = document.getElementById('kickoffDivisionList');
    if (!list) return false;
    list.querySelectorAll('.kickoff-division-card').forEach(card => {
      const actions = card.querySelector('.kickoff-division-footer-actions');
      const proposalButton = actions?.querySelector('[data-kickoff-show-proposal-text]');
      if (!actions || !proposalButton || actions.querySelector('[data-kickoff-show-internal-notes]')) return;
      const button = document.createElement('button');
      button.className = proposalButton.className || 'btn btn-secondary';
      button.type = 'button';
      button.dataset.kickoffShowInternalNotes = 'true';
      button.textContent = '+ Notes';
      proposalButton.insertAdjacentElement('afterend', button);
    });
    return true;
  }

  document.addEventListener('click', event => {
    const notesButton = event.target?.closest?.('[data-kickoff-show-internal-notes]');
    if (notesButton) {
      event.preventDefault();
      openNotesReference(notesButton.closest('.kickoff-division-card'));
      return;
    }
    const proposalButton = event.target?.closest?.('[data-kickoff-show-proposal-text]');
    if (proposalButton) {
      restoreProposalReference(proposalButton.closest('.kickoff-division-card'));
    }
  });

  document.addEventListener('change', event => {
    const select = event.target?.closest?.('[data-kickoff-proposal-reference-select]');
    const panel = select?.closest?.('[data-kickoff-proposal-reference-panel]');
    if (!select || panel?.dataset.referenceMode !== 'notes') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    renderNotesReference(select.closest('.kickoff-division-card'), select.value);
  }, true);

  document.addEventListener('click', async event => {
    const copyButton = event.target?.closest?.('[data-kickoff-copy-proposal-text]');
    const panel = copyButton?.closest?.('[data-kickoff-proposal-reference-panel]');
    if (!copyButton || panel?.dataset.referenceMode !== 'notes') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const card = copyButton.closest('.kickoff-division-card');
    const select = card?.querySelector('[data-kickoff-proposal-reference-select]');
    const project = currentProject();
    const number = String(select?.value || '').replace(NOTE_PREFIX, '');
    const html = noteHtml(project?.internalNotes?.divisions?.[number]);
    const text = plainText(html);
    if (!text) {
      if (typeof toast === 'function') toast(`No internal notes entered for Division ${number}.`);
      return;
    }
    try {
      if (navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard unavailable');
      }
      if (typeof toast === 'function') toast('Internal notes copied.');
    } catch {
      if (typeof toast === 'function') toast('Select the internal note text and copy it manually.');
    }
  }, true);

  if (typeof renderKickoffDivisions === 'function' && !renderKickoffDivisions.__internalNotesShortcut) {
    const originalRender = renderKickoffDivisions;
    const wrappedRender = function() {
      const result = originalRender.apply(this, arguments);
      queueMicrotask(enhanceNotesButtons);
      return result;
    };
    wrappedRender.__internalNotesShortcut = true;
    renderKickoffDivisions = wrappedRender;
    window.renderKickoffDivisions = wrappedRender;
  }

  enhanceNotesButtons();
  window.__kickoffInternalNotesReference = '2026-09-17-1';
})();
