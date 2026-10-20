/**
 * content.js - Script de continut extins cu:
 * 1. Detectare automata Engleza vs Romana
 * 2. Dictionar personalizat de exceptii
 * 3. Mini-meniu plutitor la selectie (stil Grammarly)
 * 4. Suport AI avansat (Google Gemini API)
 */

(function () {
  'use strict';

  // Setari implicite
  let settings = {
    enabled: true,
    autoMode: true,
    sentenceMode: true,
    floatingButton: true,
    detectLanguage: true,
    selectionMenu: true,
    excludedDomains: ['github.com', 'gitlab.com', 'stackoverflow.com', 'codepen.io'],
    customExceptions: ['Alex', 'JavaScript', 'Python', 'Node', 'PR', 'CEO', 'React'],
    geminiApiKey: ''
  };

  let activeElement = null;
  let isReplacing = false;
  let lastReplacement = null;
  const ignoredWords = new Set();
  let floatingBadge = null;
  let selectionBubble = null;
  let toastElement = null;
  let currentSelectionText = '';

  // Incarcare si sincronizare setari
  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(settings, (items) => {
        if (items) {
          settings = Object.assign(settings, items);
          updateBadgeVisibility();
        }
      });
    }
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        for (const key in changes) {
          settings[key] = changes[key].newValue;
        }
        updateBadgeVisibility();
      }
    });
  }

  loadSettings();

  // Verificare domeniu exclus
  function isCurrentDomainExcluded() {
    const hostname = window.location.hostname.toLowerCase();
    return settings.excludedDomains.some(domain => hostname.includes(domain.toLowerCase()));
  }

  // Verificare element editabil
  function isEditableElement(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      const type = (el.type || el.getAttribute('type') || 'text').toLowerCase();
      const validTypes = ['text', 'search', 'url', ''];
      return validTypes.includes(type);
    }
    return false;
  }

  function isCodeEditor(el) {
    if (!el) return false;
    return !!el.closest('pre, code, .monaco-editor, .ace_editor, .CodeMirror');
  }

  function setNativeInputValue(el, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
    const prototype = Object.getPrototypeOf(el);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(el, value);
    } else if (valueSetter) {
      valueSetter.call(el, value);
    } else {
      el.value = value;
    }
  }

  // Notificare toast
  function showToast(message, isSuccess = true) {
    if (!toastElement) {
      toastElement = document.createElement('div');
      toastElement.className = 'diacritice-toast';
      toastElement.innerHTML = `<span class="diacritice-toast-icon">✓</span> <span class="diacritice-toast-text"></span>`;
      document.body.appendChild(toastElement);
    }
    toastElement.querySelector('.diacritice-toast-icon').textContent = isSuccess ? '✓' : 'ℹ';
    toastElement.querySelector('.diacritice-toast-text').textContent = message;
    toastElement.classList.add('diacritice-toast-show');
    setTimeout(() => {
      if (toastElement) toastElement.classList.remove('diacritice-toast-show');
    }, 2200);
  }

  // Raportare statistici
  let pendingWordCount = 0;
  let statsTimeout = null;
  function reportWordsCorrected(count = 1) {
    pendingWordCount += count;
    if (statsTimeout) clearTimeout(statsTimeout);
    statsTimeout = setTimeout(() => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ correctedCount: 0 }, (data) => {
          const newTotal = (data.correctedCount || 0) + pendingWordCount;
          chrome.storage.sync.set({ correctedCount: newTotal });
          pendingWordCount = 0;
        });
      }
    }, 1500);
  }

  // --- 1. BUTON PLUTITOR COLTUL CAMPULUI TEXT ---

  function createFloatingBadge() {
    if (floatingBadge) return;
    floatingBadge = document.createElement('div');
    floatingBadge.className = 'diacritice-floating-badge';
    floatingBadge.title = 'Adaugă diacritice (Alt + D)';
    floatingBadge.innerHTML = `
      <span class="diacritice-glyph">ă</span>
      <span class="diacritice-text">Diacritice</span>
    `;

    floatingBadge.addEventListener('mousedown', (e) => e.preventDefault());
    floatingBadge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = isEditableElement(document.activeElement) ? document.activeElement : activeElement;
      if (target) processActiveElement(target);
    });

    document.body.appendChild(floatingBadge);
  }

  function updateBadgePosition(el) {
    if (!floatingBadge || !el || !settings.floatingButton || !settings.enabled || isCurrentDomainExcluded()) {
      if (floatingBadge) floatingBadge.classList.remove('diacritice-visible');
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
      floatingBadge.classList.remove('diacritice-visible');
      return;
    }

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    const badgeWidth = 95;
    const badgeHeight = 24;
    let top = rect.bottom + scrollY - badgeHeight - 4;
    let left = rect.right + scrollX - badgeWidth - 4;

    if (rect.height < 40) {
      top = rect.top + scrollY + (rect.height - badgeHeight) / 2;
      left = rect.right + scrollX + 8;
    }

    floatingBadge.style.top = `${top}px`;
    floatingBadge.style.left = `${left}px`;
    floatingBadge.classList.add('diacritice-visible');
  }

  function updateBadgeVisibility() {
    if (!settings.floatingButton || !settings.enabled || isCurrentDomainExcluded() || !activeElement) {
      if (floatingBadge) floatingBadge.classList.remove('diacritice-visible');
    } else if (activeElement) {
      updateBadgePosition(activeElement);
    }
  }

  // --- 2. MINI-MENIU PLUTITOR LA SELECTIE (STIL GRAMMARLY) ---

  function createSelectionBubble() {
    if (selectionBubble) return;
    selectionBubble = document.createElement('div');
    selectionBubble.className = 'diacritice-selection-bubble';

    selectionBubble.innerHTML = `
      <button class="diacritice-bubble-btn btn-primary" id="btn-bubble-add" title="Adaugă diacritice românești">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>+ Diacritice</span>
      </button>
      <button class="diacritice-bubble-btn" id="btn-bubble-remove" title="Elimină diacriticele (SMS/Formulare)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <span>Fără</span>
      </button>
      <button class="diacritice-bubble-btn" id="btn-bubble-copy" title="Copiază textul cu diacritice">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        <span>Copiază</span>
      </button>
      <button class="diacritice-bubble-btn btn-ai" id="btn-bubble-ai" title="Corectare avansată cu Google Gemini AI" style="display:none">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>
        <span>AI</span>
      </button>
      <div class="diacritice-bubble-divider"></div>
      <button class="diacritice-bubble-close" id="btn-bubble-close" title="Închide">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    selectionBubble.addEventListener('mousedown', (e) => {
      // Nu anulam selectia din pagina
      e.preventDefault();
    });

    selectionBubble.querySelector('#btn-bubble-add').addEventListener('click', (e) => {
      e.preventDefault();
      applyActionToSelection('add');
    });

    selectionBubble.querySelector('#btn-bubble-remove').addEventListener('click', (e) => {
      e.preventDefault();
      applyActionToSelection('remove');
    });

    selectionBubble.querySelector('#btn-bubble-copy').addEventListener('click', (e) => {
      e.preventDefault();
      applyActionToSelection('copy');
    });

    selectionBubble.querySelector('#btn-bubble-ai').addEventListener('click', (e) => {
      e.preventDefault();
      applyActionToSelection('ai');
    });

    selectionBubble.querySelector('#btn-bubble-close').addEventListener('click', (e) => {
      e.preventDefault();
      hideSelectionBubble();
    });

    document.body.appendChild(selectionBubble);
  }

  function hideSelectionBubble() {
    if (selectionBubble) {
      selectionBubble.classList.remove('diacritice-bubble-visible');
    }
  }

  function showSelectionBubble(rect, selectedText) {
    if (!settings.selectionMenu || !settings.enabled || isCurrentDomainExcluded()) {
      hideSelectionBubble();
      return;
    }

    createSelectionBubble();
    currentSelectionText = selectedText;

    // Afisam sau ascundem butonul AI in functie de existenta cheii API
    const aiBtn = selectionBubble.querySelector('#btn-bubble-ai');
    if (aiBtn) {
      aiBtn.style.display = settings.geminiApiKey ? 'inline-flex' : 'none';
    }

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    const bubbleWidth = settings.geminiApiKey ? 330 : 275;
    const bubbleHeight = 34;

    // Pozitionam meniul deasupra selectiei; daca nu e loc, il pozitionam sub
    let top = rect.top + scrollY - bubbleHeight - 8;
    if (rect.top < 45) {
      top = rect.bottom + scrollY + 8;
    }

    let left = rect.left + scrollX + (rect.width - bubbleWidth) / 2;
    // Limitare sa nu iasa din ecran
    left = Math.max(10, Math.min(left, window.innerWidth - bubbleWidth - 10));

    selectionBubble.style.top = `${top}px`;
    selectionBubble.style.left = `${left}px`;
    selectionBubble.classList.add('diacritice-bubble-visible');
  }

  function applyActionToSelection(action) {
    const sel = window.getSelection();
    const text = (sel && sel.toString().trim()) || currentSelectionText;
    if (!text) {
      hideSelectionBubble();
      return;
    }

    const engine = window.DiacriticeEngine;
    if (!engine) return;

    if (action === 'add') {
      const transformed = engine.processFullText(text, settings.customExceptions);
      replaceSelectionWithText(transformed);
      showToast('Diacritice adăugate!');
    } else if (action === 'remove') {
      const stripped = engine.removeDiacritics(text);
      replaceSelectionWithText(stripped);
      showToast('Diacritice eliminate!');
    } else if (action === 'copy') {
      const transformed = engine.processFullText(text, settings.customExceptions);
      navigator.clipboard.writeText(transformed).then(() => {
        showToast('Text cu diacritice copiat!');
      }).catch(() => {
        showToast('Nu s-a putut copia textul.', false);
      });
    } else if (action === 'ai') {
      showToast('Se procesează cu Gemini AI...', true);
      chrome.runtime.sendMessage({
        action: 'callGeminiAI',
        text: text,
        apiKey: settings.geminiApiKey
      }, (response) => {
        if (response && response.success) {
          replaceSelectionWithText(response.result);
          showToast('Text corectat cu succes de Gemini AI!');
        } else {
          showToast('Eroare AI: ' + (response?.error || 'Verifică cheia API'), false);
        }
      });
    }

    hideSelectionBubble();
  }

  function replaceSelectionWithText(newText) {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      const start = active.selectionStart;
      const end = active.selectionEnd;
      if (start !== null && end !== null && start !== end) {
        replaceInInputOrTextarea(active, start, end, newText);
        return;
      }
    }

    if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
      const success = document.execCommand('insertText', false, newText);
      if (success) return;
    }

    // Daca e text needitabil pe pagina, il copiem in clipboard ca ajutor
    navigator.clipboard.writeText(newText).then(() => {
      showToast('Textul rezultat a fost copiat în clipboard!');
    });
  }

  // --- 3. AUTO-CORECTIE LA TAstARE (INPUT & CONTENTEDITABLE) ---

  function replaceInInputOrTextarea(el, start, end, replacement, origCursorPos) {
    if (isReplacing) return false;
    isReplacing = true;

    try {
      const origText = el.value.slice(start, end);
      const diff = replacement.length - (end - start);
      const targetCursor = (origCursorPos !== undefined) ? (origCursorPos + diff) : (end + diff);

      if (typeof el.setRangeText === 'function') {
        el.setRangeText(replacement, start, end, 'preserve');
        el.setSelectionRange(targetCursor, targetCursor);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: replacement }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        const before = el.value.slice(0, start);
        const after = el.value.slice(end);
        setNativeInputValue(el, before + replacement + after);
        el.setSelectionRange(targetCursor, targetCursor);
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      lastReplacement = {
        element: el,
        start: start,
        length: replacement.length,
        original: origText,
        replaced: replacement,
        time: Date.now()
      };

      reportWordsCorrected(1);
      return true;
    } catch (err) {
      console.warn('[Diacritice] Eroare replace:', err);
      return false;
    } finally {
      isReplacing = false;
    }
  }

  function checkAndAutoCorrectInput(el, triggerChar) {
    if (!settings.enabled || !settings.autoMode || isCurrentDomainExcluded() || isCodeEditor(el)) {
      return;
    }

    const text = el.value;
    const cursorPos = el.selectionStart;
    if (cursorPos === null || cursorPos === undefined || cursorPos === 0) return;

    const textBefore = text.slice(0, cursorPos);

    // FUNCTIE 1: Verificare context limba engleza
    if (settings.detectLanguage && window.DiacriticeEngine && window.DiacriticeEngine.isEnglishContext(textBefore)) {
      return; // Oprim corectia daca utilizatorul scrie in engleza
    }

    const match = textBefore.match(/([a-zA-ZăâîșțĂÂÎȘȚ\-]+)([\s.,!?;:]+)$/);
    if (!match) return;

    const rawWord = match[1];
    const trailingSeparators = match[2];
    const wordEnd = textBefore.length - trailingSeparators.length;
    const wordStart = wordEnd - rawWord.length;

    if (ignoredWords.has(rawWord.toLowerCase())) {
      return;
    }

    const engine = window.DiacriticeEngine;
    if (!engine) return;

    // FUNCTIE 2: Trimitem lista de exceptii personalizate
    const corrected = engine.restoreWord(rawWord, settings.customExceptions);
    if (corrected && corrected !== rawWord) {
      replaceInInputOrTextarea(el, wordStart, wordEnd, corrected, cursorPos);
    }

    if (settings.sentenceMode && /[.!?\n]/.test(triggerChar || trailingSeparators)) {
      refineInputSentence(el, cursorPos);
    }
  }

  function refineInputSentence(el, cursorPos) {
    const text = el.value;
    const textBefore = text.slice(0, cursorPos);
    const lastBoundary = Math.max(
      textBefore.lastIndexOf('.', textBefore.length - 2),
      textBefore.lastIndexOf('!', textBefore.length - 2),
      textBefore.lastIndexOf('?', textBefore.length - 2),
      textBefore.lastIndexOf('\n', textBefore.length - 2),
      0
    );
    const sentenceStart = lastBoundary === 0 ? 0 : lastBoundary + 1;
    const sentence = text.slice(sentenceStart, cursorPos);

    if (sentence.length < 3) return;

    const engine = window.DiacriticeEngine;
    if (!engine) return;

    const refined = engine.refineSentence(sentence);
    if (refined && refined !== sentence) {
      replaceInInputOrTextarea(el, sentenceStart, cursorPos, refined, cursorPos);
    }
  }

  function checkAndAutoCorrectContentEditable(el, triggerChar) {
    if (!settings.enabled || !settings.autoMode || isCurrentDomainExcluded() || isCodeEditor(el)) {
      return;
    }

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent;
    const offset = range.startOffset;
    const textBefore = text.slice(0, offset);

    // FUNCTIE 1: Verificare detectare Engleza
    if (settings.detectLanguage && window.DiacriticeEngine && window.DiacriticeEngine.isEnglishContext(textBefore)) {
      return;
    }

    const match = textBefore.match(/([a-zA-ZăâîșțĂÂÎȘȚ\-]+)([\s.,!?;:]+)$/);
    if (!match) return;

    const rawWord = match[1];
    const trailingSeparators = match[2];
    const wordEnd = offset - trailingSeparators.length;
    const wordStart = wordEnd - rawWord.length;

    if (ignoredWords.has(rawWord.toLowerCase())) {
      return;
    }

    const engine = window.DiacriticeEngine;
    if (!engine) return;

    // FUNCTIE 2: Verificare exceptii personalizate
    const corrected = engine.restoreWord(rawWord, settings.customExceptions);
    if (!corrected || corrected === rawWord) return;

    isReplacing = true;
    try {
      const wordRange = document.createRange();
      wordRange.setStart(node, wordStart);
      wordRange.setEnd(node, wordEnd);

      wordRange.deleteContents();
      const textNode = document.createTextNode(corrected);
      wordRange.insertNode(textNode);

      const newRange = document.createRange();
      const diff = corrected.length - rawWord.length;
      const newOffset = offset + diff;

      let targetNode = textNode;
      if (textNode.nextSibling && textNode.nextSibling.nodeType === Node.TEXT_NODE) {
        targetNode = textNode.nextSibling;
        newRange.setStart(targetNode, trailingSeparators.length);
      } else {
        newRange.setStart(node, Math.min(newOffset, node.textContent.length));
      }

      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: corrected }));

      lastReplacement = {
        element: el,
        node: targetNode,
        original: rawWord,
        replaced: corrected,
        time: Date.now()
      };

      reportWordsCorrected(1);
    } catch (e) {
      console.warn('[Diacritice] Fallback contenteditable:', e);
    } finally {
      isReplacing = false;
    }
  }

  function handleBackspace(e, el) {
    if (!lastReplacement) return;
    const now = Date.now();
    if (now - lastReplacement.time < 3000 && lastReplacement.element === el) {
      ignoredWords.add(lastReplacement.original.toLowerCase());

      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const currentPos = el.selectionStart;
        if (currentPos >= lastReplacement.start + lastReplacement.length) {
          e.preventDefault();
          const orig = lastReplacement.original;
          replaceInInputOrTextarea(el, lastReplacement.start, lastReplacement.start + lastReplacement.length, orig, currentPos);
          lastReplacement = null;
        }
      }
    }
  }

  function processActiveElement(el) {
    const engine = window.DiacriticeEngine;
    if (!el || !engine) return;

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const start = el.selectionStart;
      const end = el.selectionEnd;

      if (start !== null && end !== null && start !== end) {
        const selectedText = el.value.slice(start, end);
        const transformed = engine.processFullText(selectedText, settings.customExceptions);
        if (transformed !== selectedText) {
          replaceInInputOrTextarea(el, start, end, transformed);
          showToast('Diacritice adăugate la selecție!');
        }
      } else {
        const fullText = el.value;
        const transformed = engine.processFullText(fullText, settings.customExceptions);
        if (transformed !== fullText) {
          replaceInInputOrTextarea(el, 0, fullText.length, transformed);
          showToast('Diacritice adăugate la text!');
        }
      }
    } else if (el.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const selectedText = sel.toString();
        const transformed = engine.processFullText(selectedText, settings.customExceptions);
        if (transformed !== selectedText) {
          document.execCommand('insertText', false, transformed);
          showToast('Diacritice adăugate la selecție!');
        }
      } else {
        const fullText = el.innerText || el.textContent;
        const transformed = engine.processFullText(fullText, settings.customExceptions);
        if (transformed !== fullText) {
          el.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, transformed);
          showToast('Diacritice adăugate la mesaj!');
        }
      }
    }
  }

  function removeDiacriticsFromActiveElement(el) {
    const engine = window.DiacriticeEngine;
    if (!el || !engine) return;

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start !== null && end !== null && start !== end) {
        const selectedText = el.value.slice(start, end);
        const stripped = engine.removeDiacritics(selectedText);
        replaceInInputOrTextarea(el, start, end, stripped);
        showToast('Diacritice eliminate din selecție!');
      } else {
        const stripped = engine.removeDiacritics(el.value);
        replaceInInputOrTextarea(el, 0, el.value.length, stripped);
        showToast('Diacritice eliminate din text!');
      }
    } else if (el.isContentEditable) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        const stripped = engine.removeDiacritics(sel.toString());
        document.execCommand('insertText', false, stripped);
        showToast('Diacritice eliminate din selecție!');
      } else {
        const stripped = engine.removeDiacritics(el.innerText || el.textContent);
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, stripped);
        showToast('Diacritice eliminate din mesaj!');
      }
    }
  }

  // --- 4. EVENIMENTE GLOBALE ---

  // Focus & Blur
  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (isEditableElement(target) && !isCodeEditor(target)) {
      activeElement = target;
      createFloatingBadge();
      updateBadgePosition(target);
    }
  }, true);

  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (document.activeElement !== activeElement) {
        updateBadgeVisibility();
      }
    }, 150);
  }, true);

  window.addEventListener('resize', () => {
    if (activeElement) updateBadgePosition(activeElement);
  });

  window.addEventListener('scroll', () => {
    if (activeElement) updateBadgePosition(activeElement);
  }, true);

  // Interceptare tastare (input & keydown)
  document.addEventListener('input', (e) => {
    if (isReplacing) return;
    const target = e.target;
    if (!isEditableElement(target)) return;

    const data = e.data;
    if (data && /[\s.,!?;:]/.test(data)) {
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        checkAndAutoCorrectInput(target, data);
      } else if (target.isContentEditable) {
        checkAndAutoCorrectContentEditable(target, data);
      }
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      const el = isEditableElement(document.activeElement) ? document.activeElement : activeElement;
      if (el) processActiveElement(el);
      return;
    }

    const target = e.target;
    if (!isEditableElement(target)) return;

    if (e.key === 'Backspace') {
      handleBackspace(e, target);
      return;
    }

    if (e.key === ' ' || e.key === 'Enter') {
      setTimeout(() => {
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          checkAndAutoCorrectInput(target, e.key);
        } else if (target.isContentEditable) {
          checkAndAutoCorrectContentEditable(target, e.key);
        }
      }, 0);
    }
  }, true);

  // Monitorizare selectie de text cu mouse-ul (Meniu stil Grammarly)
  document.addEventListener('mouseup', (e) => {
    // Ignoram click-urile din interiorul meniului plutitor
    if (selectionBubble && selectionBubble.contains(e.target)) return;

    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        hideSelectionBubble();
        return;
      }

      const text = sel.toString().trim();
      // Afisam doar daca sunt selectate cel putin 2 caractere
      if (text.length >= 2) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          showSelectionBubble(rect, text);
          return;
        }
      }
      hideSelectionBubble();
    }, 20);
  });

  document.addEventListener('mousedown', (e) => {
    if (selectionBubble && !selectionBubble.contains(e.target)) {
      hideSelectionBubble();
    }
  });

  // Ascultator mesaje externe
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      const el = isEditableElement(document.activeElement) ? document.activeElement : activeElement;
      if (request.action === 'processActiveText') {
        if (el) {
          processActiveElement(el);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, reason: 'Niciun câmp text activ' });
        }
      } else if (request.action === 'removeDiacriticsText') {
        if (el) {
          removeDiacriticsFromActiveElement(el);
          sendResponse({ success: true });
        }
      } else if (request.action === 'ping') {
        sendResponse({ status: 'active' });
      }
      return true;
    });
  }

  console.log('[Diacritice Românești] Content script v1.1.0 pregătit.');
})();
