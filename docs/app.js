/**
 * docs/app.js - Interactive Typing Simulator & Demo Controller for GitHub Pages
 */

document.addEventListener('DOMContentLoaded', () => {
  const simInput = document.getElementById('sim-input');
  const simStatus = document.getElementById('sim-status-label');
  const btnModeAuto = document.getElementById('btn-mode-auto');
  const btnModeManual = document.getElementById('btn-mode-manual');
  const capsuleDemo = document.getElementById('capsule-demo');

  let currentMode = 'auto'; // 'auto' | 'manual'
  let autoTypingTimer = null;
  let isTyping = false;

  const demoScenarios = [
    "Salut Alex! Cand mergem la scoala impreuna daca poti?",
    "In viata trebuie sa fii atent si sa nu renunti niciodata.",
    "Multumesc frumos pentru ajutor, a fost o zi minunata.",
    "Nu stiu ce sa cred, dar cred ca este o idee foarte buna."
  ];

  let scenarioIndex = 0;

  // 1. Simulator Auto-Typing Video Animation
  function startAutoTypingDemo() {
    clearTimeout(autoTypingTimer);
    simInput.value = '';
    simStatus.textContent = 'Demo Animat: Se tastează...';
    simInput.readOnly = true;

    const fullSentence = demoScenarios[scenarioIndex];
    scenarioIndex = (scenarioIndex + 1) % demoScenarios.length;

    let charIndex = 0;
    let currentBuffer = '';

    function typeNextChar() {
      if (currentMode !== 'auto') return;

      if (charIndex < fullSentence.length) {
        const ch = fullSentence[charIndex];
        currentBuffer += ch;
        simInput.value = currentBuffer;
        charIndex++;

        // Daca s-a tastat spatiu sau punctuatie, simulam inlocuirea automata
        if (/[\s.,!?]/.test(ch) && window.DiacriticeEngine) {
          const transformed = window.DiacriticeEngine.processFullText(currentBuffer);
          if (transformed !== currentBuffer) {
            currentBuffer = transformed;
            simInput.value = currentBuffer;
          }
        }

        // Viteza dinamica de tastare realista
        const speed = ch === ' ' ? 180 : Math.floor(Math.random() * 40 + 50);
        autoTypingTimer = setTimeout(typeNextChar, speed);
      } else {
        // Fraza completata
        simStatus.textContent = '✓ Diacritice adăugate automat!';
        // Pauza de 3.5 secunde inainte de urmatorul scenariu
        autoTypingTimer = setTimeout(() => {
          if (currentMode === 'auto') {
            startAutoTypingDemo();
          }
        }, 3500);
      }
    }

    typeNextChar();
  }

  // 2. Comutare Moduri (Demo vs Manual)
  btnModeAuto.addEventListener('click', () => {
    if (currentMode === 'auto') return;
    currentMode = 'auto';
    btnModeAuto.classList.add('active');
    btnModeManual.classList.remove('active');
    startAutoTypingDemo();
  });

  btnModeManual.addEventListener('click', () => {
    currentMode = 'manual';
    clearTimeout(autoTypingTimer);
    btnModeManual.classList.add('active');
    btnModeAuto.classList.remove('active');

    simInput.readOnly = false;
    simInput.value = '';
    simStatus.textContent = 'Mod Manual: Tastează liber orice propoziție și apasă Spațiu...';
    simInput.focus();
  });

  // 3. Logica de Tastare Live in Mod Manual
  simInput.addEventListener('input', (e) => {
    if (currentMode !== 'manual' || !window.DiacriticeEngine) return;

    const data = e.data;
    if (data && /[\s.,!?;:]/.test(data)) {
      const text = simInput.value;
      const cursorPos = simInput.selectionStart;
      const textBefore = text.slice(0, cursorPos);
      const match = textBefore.match(/([a-zA-ZăâîșțĂÂÎȘȚ\-]+)([\s.,!?;:]+)$/);
      if (!match) return;

      const rawWord = match[1];
      const trailing = match[2];
      const wordEnd = textBefore.length - trailing.length;
      const wordStart = wordEnd - rawWord.length;

      const corrected = window.DiacriticeEngine.restoreWord(rawWord);
      if (corrected && corrected !== rawWord) {
        const before = text.slice(0, wordStart);
        const after = text.slice(wordEnd);
        simInput.value = before + corrected + after;
        const newPos = wordStart + corrected.length + trailing.length;
        simInput.setSelectionRange(newPos, newPos);
        simStatus.textContent = `✓ Corectat: "${rawWord}" ➔ "${corrected}"`;
      }
    }
  });

  simInput.addEventListener('keydown', (e) => {
    if (currentMode !== 'manual') return;

    if (e.key === ' ' || e.key === 'Enter') {
      setTimeout(() => {
        if (!window.DiacriticeEngine) return;
        const text = simInput.value;
        const cursorPos = simInput.selectionStart;
        const textBefore = text.slice(0, cursorPos);
        const match = textBefore.match(/([a-zA-ZăâîșțĂÂÎȘȚ\-]+)([\s.,!?;:]+)$/);
        if (!match) return;

        const rawWord = match[1];
        const trailing = match[2];
        const wordEnd = textBefore.length - trailing.length;
        const wordStart = wordEnd - rawWord.length;

        const corrected = window.DiacriticeEngine.restoreWord(rawWord);
        if (corrected && corrected !== rawWord) {
          const before = text.slice(0, wordStart);
          const after = text.slice(wordEnd);
          simInput.value = before + corrected + after;
          const newPos = wordStart + corrected.length + trailing.length;
          simInput.setSelectionRange(newPos, newPos);
          simStatus.textContent = `✓ Corectat: "${rawWord}" ➔ "${corrected}"`;
        }
      }, 0);
    }
  });

  // 4. Actiuni pe Capsula Plutitoare Demo
  const capsuleBtns = capsuleDemo.querySelectorAll('.capsule-btn');
  capsuleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const text = simInput.value;
      if (!text || !window.DiacriticeEngine) return;

      if (btn.textContent.includes('+ Diacritice')) {
        simInput.value = window.DiacriticeEngine.processFullText(text);
        simStatus.textContent = '✓ Diacritice adăugate la întregul text!';
      } else if (btn.textContent.includes('Fără')) {
        simInput.value = window.DiacriticeEngine.removeDiacritics(text);
        simStatus.textContent = '✓ Diacritice eliminate (format SMS)!';
      } else if (btn.textContent.includes('Copiază')) {
        navigator.clipboard.writeText(simInput.value).then(() => {
          simStatus.textContent = '📋 Text copiat în clipboard!';
        });
      } else if (btn.textContent.includes('AI')) {
        simStatus.textContent = '✨ Gemini AI: Text validat și optimizat!';
      }
    });
  });

  // Pornire initiala
  startAutoTypingDemo();
});
