(() => {
  // Currency display formatting for Proposal + Kickoff monetary inputs.
  // Keep typing simple: add the dollar sign while entering a value, then add
  // thousands separators when the user leaves the field.
  const currencySelector = [
    '.price-value',
    '.basic-summary-amount',
    '#basicOverheadAmount',
    '.summary-division-amount',
    '.summary-sub-amount',
    '.summary-custom-amount',
    '.summary-extra-amount',
    '[data-kickoff-info="contractValue"]',
    '[data-kickoff-division-field="budget"]'
  ].join(',');

  function hasNumericValue(value) {
    return /\d/.test(String(value ?? ''));
  }

  function liveDollarPrefix(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.includes('$')) return raw;
    if (raw.startsWith('-')) return `-$${raw.slice(1)}`;
    if (raw.startsWith('(') && raw.endsWith(')')) return `($${raw.slice(1, -1)})`;
    return `$${raw}`;
  }

  function formatCurrencyValue(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (!hasNumericValue(raw)) return raw;

    const parentheticalNegative = /^\(.*\)$/.test(raw);
    const negative = parentheticalNegative || /^\s*-/.test(raw);
    const numericText = raw.replace(/[^0-9.]/g, '');
    const firstDecimal = numericText.indexOf('.');
    const normalizedText = firstDecimal >= 0
      ? numericText.slice(0, firstDecimal + 1) + numericText.slice(firstDecimal + 1).replace(/\./g, '')
      : numericText;
    let amount = Number.parseFloat(normalizedText);
    if (!Number.isFinite(amount)) return liveDollarPrefix(raw);
    if (negative) amount = -Math.abs(amount);

    const decimalMatch = normalizedText.match(/\.(\d+)/);
    const enteredDecimals = decimalMatch ? decimalMatch[1].length : 0;
    const showCents = enteredDecimals > 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function refreshTotalsFor(input) {
    try {
      if (input.matches('.basic-summary-amount,#basicOverheadAmount') && typeof updateBasicSummaryTotal === 'function') updateBasicSummaryTotal();
      if (input.matches('.summary-division-amount,.summary-sub-amount,.summary-custom-amount,.summary-extra-amount') && typeof updateAdvancedSummaryTotals === 'function') updateAdvancedSummaryTotals();
    } catch (err) {
      console.warn('Currency total refresh failed.', err);
    }
  }

  document.addEventListener('input', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches(currencySelector)) return;
    const next = liveDollarPrefix(input.value);
    if (next !== input.value) {
      const wasAtEnd = input.selectionStart === input.value.length;
      input.value = next;
      if (wasAtEnd) {
        try { input.setSelectionRange(next.length, next.length); } catch {}
      }
    }
  });

  document.addEventListener('focusout', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches(currencySelector)) return;
    const next = formatCurrencyValue(input.value);
    if (next === input.value) return;
    input.value = next;
    refreshTotalsFor(input);

    // Existing proposal/kickoff listeners save on input, so dispatch one after the
    // final formatted value is written to ensure the formatted amount is persisted.
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  window.formatKoehnCurrencyValue = formatCurrencyValue;
})();

(() => {
  // Proposal-only controls: custom alternate section title, long-title wrapping,
  // and optional Base Bid display for unit-price proposals.
  if (!document.querySelector('script[data-proposal-alternate-controls]')) {
    const script = document.createElement('script');
    script.src = 'proposal-alternate-controls.js?v=20260904-2';
    script.async = false;
    script.dataset.proposalAlternateControls = 'true';
    script.onerror = () => console.error('Proposal alternate controls failed to load.');
    document.head.appendChild(script);
  }
})();

(() => {
  // Scope-wide usability controls: canonical project name, inline alternate header,
  // reversible kickoff status, and manual PDF previews.
  if (!document.querySelector('script[data-scope-site-controls]')) {
    const script = document.createElement('script');
    script.src = 'scope-site-controls.js?v=20260909-1';
    script.async = false;
    script.dataset.scopeSiteControls = 'true';
    script.onerror = () => console.error('Scope site usability controls failed to load.');
    document.head.appendChild(script);
  }
})();

(() => {
  // Keep PDF underlines continuous through spaces in Proposal and Kickoff text.
  if (!document.querySelector('script[data-underline-space-fix]')) {
    const script = document.createElement('script');
    script.src = 'underline-space-fix.js?v=20260910-1';
    script.async = false;
    script.dataset.underlineSpaceFix = 'true';
    script.onerror = () => console.error('Continuous PDF underline fix failed to load.');
    document.head.appendChild(script);
  }
})();
