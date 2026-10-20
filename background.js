/**
 * background.js - Service Worker pentru extensia Diacritice Automate Românești (Manifest V3)
 * Gestioneaza meniuri contextuale, comenzi rapide si integrarea Gemini AI.
 */

chrome.runtime.onInstalled.addListener(async () => {
  // Initializare setari implicite
  chrome.storage.sync.get({
    enabled: true,
    autoMode: true,
    sentenceMode: true,
    floatingButton: true,
    detectLanguage: true,
    selectionMenu: true,
    excludedDomains: ['github.com', 'gitlab.com', 'stackoverflow.com', 'codepen.io'],
    customExceptions: ['Alex', 'JavaScript', 'Python', 'Node', 'PR', 'CEO', 'React'],
    geminiApiKey: '',
    correctedCount: 0
  }, (items) => {
    chrome.storage.sync.set(items);
  });

  // Meniuri contextuale la click dreapta
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'diacritice-add',
      title: '🇷🇴 Adaugă diacritice românești',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'diacritice-remove',
      title: '🔤 Elimină diacriticele (fără diacritice)',
      contexts: ['selection', 'editable']
    });
  });

  // Auto-injectare in tab-urile deschise
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content.css']
          });
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['dict.js', 'rules.js', 'content.js']
          });
        } catch (e) {
          // Tab ignorat
        }
      }
    }
  } catch (err) {
    console.warn('[Diacritice] Auto-injectare tab-uri:', err);
  }

  console.log('[Diacritice] Service worker initializat cu succes.');
});

// Tratare click pe meniuri contextuale
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === 'diacritice-add') {
    chrome.tabs.sendMessage(tab.id, { action: 'processActiveText' });
  } else if (info.menuItemId === 'diacritice-remove') {
    chrome.tabs.sendMessage(tab.id, { action: 'removeDiacriticsText' });
  }
});

// Comenzi rapide de la tastatura
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-diacritics') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'processActiveText' });
      }
    });
  }
});

// Integrare Gemini AI via API REST
async function callGeminiAI(text, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Cheia API Gemini nu este configurată.');
  }

  // Model recomandat: gemini-2.5-flash sau gemini-1.5-flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const prompt = `Ești un asistent lingvist expert în limba română. Sarcina ta este să adaugi diacriticele corecte (ă, â, î, ș, ț cu virgulă dedesubt conform normelor Academiei Române) în următorul text, păstrând formatarea exactă, semnele de punctuație, majusculele și cuvintele în alte limbi (engleză, termeni tehnici). Răspunde strict DOAR cu textul corectat, fără niciun alt comentariu, explicație sau ghilimele:\n\n${text}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Eroare HTTP ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidate) {
    throw new Error('Răspunsul AI este gol.');
  }

  return candidate.trim();
}

// Ascultare mesaje interne (de la content script sau popup)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callGeminiAI') {
    callGeminiAI(request.text, request.apiKey)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }
});
