/**
 * popup.js - Logica pentru interfata popup extinsa a extensiei
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elemente Tab Navigation
  const tabBtns = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-pane');

  // Elemente Switch & Optiuni
  const masterToggle = document.getElementById('master-toggle');
  const optAutoMode = document.getElementById('opt-auto-mode');
  const optDetectLanguage = document.getElementById('opt-detect-language');
  const optSelectionMenu = document.getElementById('opt-selection-menu');
  const optSentenceMode = document.getElementById('opt-sentence-mode');
  const optFloatingBtn = document.getElementById('opt-floating-btn');

  // Status & Contor
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const wordsCounter = document.getElementById('words-counter');

  // Zona de Test
  const testTextarea = document.getElementById('test-textarea');
  const btnTestConvert = document.getElementById('btn-test-convert');
  const btnTestStrip = document.getElementById('btn-test-strip');

  // Dictionar Personalizat
  const inputNewWord = document.getElementById('input-new-word');
  const btnAddWord = document.getElementById('btn-add-word');
  const customWordsList = document.getElementById('custom-words-list');

  // Gemini AI
  const inputApiKey = document.getElementById('input-api-key');
  const btnSaveAi = document.getElementById('btn-save-ai');
  const btnTestAi = document.getElementById('btn-test-ai');
  const aiStatusIndicator = document.getElementById('ai-status-indicator');
  const aiTestResult = document.getElementById('ai-test-result');

  // Site-uri Excluse
  const btnExcludeCurrent = document.getElementById('btn-exclude-current');
  const excludedListContainer = document.getElementById('excluded-list');

  let currentSettings = {
    enabled: true,
    autoMode: true,
    detectLanguage: true,
    selectionMenu: true,
    sentenceMode: true,
    floatingButton: true,
    excludedDomains: ['github.com', 'gitlab.com', 'stackoverflow.com', 'codepen.io'],
    customExceptions: ['Alex', 'JavaScript', 'Python', 'Node', 'PR', 'CEO', 'React'],
    geminiApiKey: '',
    correctedCount: 0
  };

  // 1. Schimbare Tab-uri
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = document.getElementById(btn.getAttribute('data-tab'));
      if (targetTab) targetTab.classList.add('active');
    });
  });

  // 2. Incarcare setari din storage
  chrome.storage.sync.get(currentSettings, (items) => {
    currentSettings = Object.assign(currentSettings, items);

    masterToggle.checked = currentSettings.enabled;
    optAutoMode.checked = currentSettings.autoMode;
    optDetectLanguage.checked = currentSettings.detectLanguage;
    optSelectionMenu.checked = currentSettings.selectionMenu;
    optSentenceMode.checked = currentSettings.sentenceMode;
    optFloatingBtn.checked = currentSettings.floatingButton;

    wordsCounter.textContent = `${currentSettings.correctedCount || 0} cuvinte`;
    inputApiKey.value = currentSettings.geminiApiKey || '';

    updateStatusUI(currentSettings.enabled);
    updateAiStatusUI(currentSettings.geminiApiKey);
    renderCustomWords();
    renderExcludedDomains();
  });

  function updateStatusUI(enabled) {
    if (enabled) {
      statusDot.className = 'live-dot';
      statusText.textContent = 'Activ';
    } else {
      statusDot.className = 'live-dot paused';
      statusText.textContent = 'Pauză';
    }
  }

  function updateAiStatusUI(key) {
    if (key && key.trim()) {
      aiStatusIndicator.textContent = 'Configurat';
      aiStatusIndicator.className = 'ai-chip connected';
    } else {
      aiStatusIndicator.textContent = 'Inactiv';
      aiStatusIndicator.className = 'ai-chip';
    }
  }

  // 3. Salvare Optiuni
  masterToggle.addEventListener('change', () => {
    currentSettings.enabled = masterToggle.checked;
    chrome.storage.sync.set({ enabled: currentSettings.enabled });
    updateStatusUI(currentSettings.enabled);
  });

  optAutoMode.addEventListener('change', () => {
    currentSettings.autoMode = optAutoMode.checked;
    chrome.storage.sync.set({ autoMode: currentSettings.autoMode });
  });

  optDetectLanguage.addEventListener('change', () => {
    currentSettings.detectLanguage = optDetectLanguage.checked;
    chrome.storage.sync.set({ detectLanguage: currentSettings.detectLanguage });
  });

  optSelectionMenu.addEventListener('change', () => {
    currentSettings.selectionMenu = optSelectionMenu.checked;
    chrome.storage.sync.set({ selectionMenu: currentSettings.selectionMenu });
  });

  optSentenceMode.addEventListener('change', () => {
    currentSettings.sentenceMode = optSentenceMode.checked;
    chrome.storage.sync.set({ sentenceMode: currentSettings.sentenceMode });
  });

  optFloatingBtn.addEventListener('change', () => {
    currentSettings.floatingButton = optFloatingBtn.checked;
    chrome.storage.sync.set({ floatingButton: currentSettings.floatingButton });
  });

  // 4. Testare Interactiva
  btnTestConvert.addEventListener('click', () => {
    btnTestConvert.classList.add('active');
    btnTestStrip.classList.remove('active');
    let text = testTextarea.value.trim();
    if (!text) {
      testTextarea.value = 'Când mergi la școală și înveți, totul e mai ușor.';
      return;
    }
    if (window.DiacriticeEngine) {
      testTextarea.value = window.DiacriticeEngine.processFullText(text, currentSettings.customExceptions);
    }
  });

  btnTestStrip.addEventListener('click', () => {
    btnTestStrip.classList.add('active');
    btnTestConvert.classList.remove('active');
    let text = testTextarea.value.trim();
    if (!text) {
      testTextarea.value = 'Cand mergi la scoala si inveti, totul e mai usor.';
      return;
    }
    if (window.DiacriticeEngine) {
      testTextarea.value = window.DiacriticeEngine.removeDiacritics(text);
    }
  });

  function checkPopupTyping() {
    if (!window.DiacriticeEngine) return;
    const text = testTextarea.value;
    const cursorPos = testTextarea.selectionStart;
    if (cursorPos === null || cursorPos === 0) return;

    const textBefore = text.slice(0, cursorPos);

    if (currentSettings.detectLanguage && window.DiacriticeEngine.isEnglishContext(textBefore)) {
      return;
    }

    const match = textBefore.match(/([a-zA-ZăâîșțĂÂÎȘȚ\-]+)([\s.,!?;:]+)$/);
    if (!match) return;

    const rawWord = match[1];
    const trailing = match[2];
    const wordEnd = textBefore.length - trailing.length;
    const wordStart = wordEnd - rawWord.length;

    const corrected = window.DiacriticeEngine.restoreWord(rawWord, currentSettings.customExceptions);
    if (corrected && corrected !== rawWord) {
      const before = text.slice(0, wordStart);
      const after = text.slice(wordEnd);
      testTextarea.value = before + corrected + after;
      const newPos = wordStart + corrected.length + trailing.length;
      testTextarea.setSelectionRange(newPos, newPos);
    }
  }

  testTextarea.addEventListener('input', (e) => {
    if (e.data && /[\s.,!?;:]/.test(e.data)) {
      checkPopupTyping();
    }
  });

  testTextarea.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      setTimeout(checkPopupTyping, 0);
    }
  });

  // 5. Dictionar Personalizat de Exceptii
  function renderCustomWords() {
    customWordsList.innerHTML = '';
    if (!currentSettings.customExceptions || currentSettings.customExceptions.length === 0) {
      customWordsList.innerHTML = '<span class="empty-state">Niciun cuvânt personalizat adăugat</span>';
      return;
    }

    currentSettings.customExceptions.forEach((word) => {
      const chip = document.createElement('div');
      chip.className = 'tag-chip';
      chip.innerHTML = `
        <span>${word}</span>
        <span class="tag-remove" title="Șterge">&times;</span>
      `;
      chip.querySelector('.tag-remove').addEventListener('click', () => {
        removeCustomWord(word);
      });
      customWordsList.appendChild(chip);
    });
  }

  function addCustomWord() {
    const word = inputNewWord.value.trim();
    if (!word) return;

    if (!currentSettings.customExceptions.includes(word)) {
      currentSettings.customExceptions.push(word);
      chrome.storage.sync.set({ customExceptions: currentSettings.customExceptions }, () => {
        inputNewWord.value = '';
        renderCustomWords();
      });
    }
  }

  function removeCustomWord(word) {
    currentSettings.customExceptions = currentSettings.customExceptions.filter(w => w !== word);
    chrome.storage.sync.set({ customExceptions: currentSettings.customExceptions }, () => {
      renderCustomWords();
    });
  }

  btnAddWord.addEventListener('click', addCustomWord);
  inputNewWord.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomWord();
    }
  });

  // 6. Gemini AI Config & Test
  btnSaveAi.addEventListener('click', () => {
    const key = inputApiKey.value.trim();
    currentSettings.geminiApiKey = key;
    chrome.storage.sync.set({ geminiApiKey: key }, () => {
      updateAiStatusUI(key);
      showAiResult('Cheia API Gemini a fost salvată cu succes!', true);
    });
  });

  btnTestAi.addEventListener('click', () => {
    const key = inputApiKey.value.trim();
    if (!key) {
      showAiResult('Te rog introdu mai întâi o cheie API Gemini.', false);
      return;
    }

    showAiResult('Se testează conexiunea cu Google Gemini...', true);
    chrome.runtime.sendMessage({
      action: 'callGeminiAI',
      text: 'Salut, testam conexiunea cu diacritice.',
      apiKey: key
    }, (response) => {
      if (response && response.success) {
        showAiResult(`✓ Conexiune reușită!\nRăspuns AI: "${response.result}"`, true);
        currentSettings.geminiApiKey = key;
        chrome.storage.sync.set({ geminiApiKey: key });
        updateAiStatusUI(key);
      } else {
        showAiResult(`✗ Eroare API: ${response?.error || 'Verifică cheia'}`, false);
      }
    });
  });

  function showAiResult(text, isSuccess) {
    aiTestResult.style.display = 'block';
    aiTestResult.style.color = isSuccess ? '#10b981' : '#f43f5e';
    aiTestResult.style.background = isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)';
    aiTestResult.style.border = isSuccess ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(244, 63, 94, 0.25)';
    aiTestResult.textContent = text;
  }

  // 7. Site-uri Excluse
  function renderExcludedDomains() {
    excludedListContainer.innerHTML = '';
    if (!currentSettings.excludedDomains || currentSettings.excludedDomains.length === 0) {
      excludedListContainer.innerHTML = '<span class="empty-state">Niciun site exclus</span>';
      return;
    }

    currentSettings.excludedDomains.forEach((domain) => {
      const chip = document.createElement('div');
      chip.className = 'tag-chip';
      chip.innerHTML = `
        <span>${domain}</span>
        <span class="tag-remove" title="Elimină">&times;</span>
      `;
      chip.querySelector('.tag-remove').addEventListener('click', () => {
        removeExcludedDomain(domain);
      });
      excludedListContainer.appendChild(chip);
    });
  }

  function removeExcludedDomain(domain) {
    currentSettings.excludedDomains = currentSettings.excludedDomains.filter(d => d !== domain);
    chrome.storage.sync.set({ excludedDomains: currentSettings.excludedDomains }, () => {
      renderExcludedDomains();
    });
  }

  btnExcludeCurrent.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          const host = url.hostname;
          if (host && !currentSettings.excludedDomains.includes(host)) {
            currentSettings.excludedDomains.push(host);
            chrome.storage.sync.set({ excludedDomains: currentSettings.excludedDomains }, () => {
              renderExcludedDomains();
            });
          }
        } catch (e) {
          console.warn('[Diacritice] Hostname invalid:', e);
        }
      }
    });
  });
});
