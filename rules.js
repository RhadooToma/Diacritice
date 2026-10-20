/**
 * rules.js - Reguli de restaurare diacritice, contextualizare, detectare limbă și morfologie.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DiacriticeEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // Eliminare diacritice completă (pentru normalizare sau conversie SMS / formulare)
  function removeDiacritics(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/ă/g, 'a').replace(/Ă/g, 'A')
      .replace(/â/g, 'a').replace(/Â/g, 'A')
      .replace(/î/g, 'i').replace(/Î/g, 'I')
      .replace(/[șş]/g, 's').replace(/[ȘŞ]/g, 'S')
      .replace(/[țţ]/g, 't').replace(/[ȚŢ]/g, 'T');
  }

  function stripDiacritics(str) {
    return removeDiacritics(str);
  }

  // Păstrează forma literelor mari / mici
  function matchCase(source, target) {
    if (!source || !target) return target;
    if (source === source.toUpperCase() && source !== source.toLowerCase()) {
      return target.toUpperCase();
    }
    if (source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase()) {
      return target.charAt(0).toUpperCase() + target.slice(1);
    }
    return target.toLowerCase();
  }

  // Cuvinte englezești distinctive (indicatori puternici de limbă engleză)
  const ENGLISH_STRONG_MARKERS = new Set([
    'the', 'this', 'that', 'with', 'from', 'have', 'has', 'had', 'would', 'could', 'should',
    'which', 'what', 'where', 'when', 'there', 'their', 'about', 'into', 'your', 'also',
    'just', 'like', 'how', 'then', 'our', 'will', 'are', 'were', 'been', 'being', 'you',
    'they', 'we', 'she', 'he', 'his', 'her', 'my', 'its', 'because', 'between', 'during',
    'through', 'against', 'without', 'before', 'after', 'above', 'below', 'under', 'again',
    'why', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'same', 'than',
    'too', 'very', 'please', 'thanks', 'thank', 'hello', 'dear', 'check', 'update', 'build'
  ]);

  // Verificare dacă un context de text este în limba engleză
  function isEnglishContext(textBefore) {
    if (!textBefore || textBefore.length < 3) return false;

    // Extragem ultimele cuvinte dinaintea cursorului (maxim ultimele 12 cuvinte)
    const tokens = textBefore.toLowerCase().match(/[a-z]+/g);
    if (!tokens || tokens.length === 0) return false;

    const recentTokens = tokens.slice(-10);

    // Numărăm markerii de engleză
    let englishHits = 0;
    for (const t of recentTokens) {
      if (ENGLISH_STRONG_MARKERS.has(t)) {
        englishHits++;
      }
    }

    // Dacă ultimul cuvânt anterior este un marker puternic (ex: "in the", "to be", "with you", "this is")
    const lastWord = recentTokens[recentTokens.length - 1];
    const secondLastWord = recentTokens.length >= 2 ? recentTokens[recentTokens.length - 2] : null;

    if (secondLastWord && ENGLISH_STRONG_MARKERS.has(secondLastWord)) {
      return true;
    }

    // Dacă avem 2 sau mai mulți markeri de engleză în ultimele cuvinte
    if (englishHits >= 2) {
      return true;
    }

    return false;
  }

  // Cuvinte care NU trebuie schimbate niciodată fără context specific
  const NEVER_CONVERT = new Set([
    'este', 'sunt', 'pentru', 'dar', 'din', 'bine', 'cu', 'la', 'pe',
    'un', 'de', 'nu', 'ce', 'e', 'am', 'ai', 'te', 'se', 'fost', 'care',
    'mai', 'da', 'el', 'ea', 'ei', 'ele', 'meu', 'nostru', 'vostru',
    'acum', 'tot', 'trebuie', 'poate', 'bun', 'zi', 'om', 'an', 'ani',
    'fel', 'loc', 'timp', 'drum', 'casa', 'mama', 'tata', 'frate',
    'sora', 'copil', 'prieten', 'lume', 'cer', 'aer', 'apa', 'foc',
    'pamant', 'soare', 'luna', 'mare', 'mic', 'mult', 'greu', 'nou',
    'vechi', 'scurt', 'lung', 'alb', 'negru', 'rosu', 'verde', 'albastru'
  ]);

  // Reguli morfologice de sufixare pentru cuvinte neaflate în dicționar
  function applyMorphologicalRules(rawWord) {
    const word = rawWord.toLowerCase();
    if (word.length < 4) return rawWord;

    if (/[aeiou][a-z]*tie$/.test(word) && !/(partie|cutie|bestie|fratie)/.test(word)) {
      return rawWord.replace(/tie$/i, (m) => matchCase(m, 'ție'));
    }
    if (/[aeiou][a-z]*tii$/.test(word) && !/(cutii|partii)/.test(word)) {
      return rawWord.replace(/tii$/i, (m) => matchCase(m, 'ții'));
    }
    if (/[a-z]+tiune$/.test(word)) {
      return rawWord.replace(/tiune$/i, (m) => matchCase(m, 'țiune'));
    }
    if (/[a-z]+tiuni$/.test(word)) {
      return rawWord.replace(/tiuni$/i, (m) => matchCase(m, 'țiuni'));
    }
    if (/[a-z]+teaza$/.test(word)) {
      return rawWord.replace(/teaza$/i, (m) => matchCase(m, 'tează'));
    }
    if (/[bcdfghjklmnprstvz]eaza$/.test(word)) {
      return rawWord.replace(/eaza$/i, (m) => matchCase(m, 'ează'));
    }
    if (/[a-z]+este$/.test(word) && !/(peste|aceste|neveste|veste)/.test(word)) {
      return rawWord.replace(/este$/i, (m) => matchCase(m, 'ește'));
    }
    if (/[a-z]+esti$/.test(word) && !/(esti|acesti|vesti)/.test(word)) {
      return rawWord.replace(/esti$/i, (m) => matchCase(m, 'ești'));
    }
    if (/[a-z]+easca$/.test(word)) {
      return rawWord.replace(/easca$/i, (m) => matchCase(m, 'ească'));
    }
    if (/[a-z]+inta$/.test(word) && !/(tinta)/.test(word)) {
      return rawWord.replace(/inta$/i, (m) => matchCase(m, 'ință'));
    }
    if (/[a-z]+inte$/.test(word) && !/(tinte|aminte|cuminte|inainte)/.test(word)) {
      return rawWord.replace(/inte$/i, (m) => matchCase(m, 'ințe'));
    }
    if (/[a-z]+anta$/.test(word) && !/(planta)/.test(word)) {
      return rawWord.replace(/anta$/i, (m) => matchCase(m, 'anță'));
    }
    if (/[a-z]+ante$/.test(word) && !/(plante)/.test(word)) {
      return rawWord.replace(/ante$/i, (m) => matchCase(m, 'anțe'));
    }

    return rawWord;
  }

  // Restaurare la nivel de cuvânt individual (cu verificare excepții personalizate)
  function restoreWord(word, customExceptions = null) {
    if (!word || word.length === 0) return word;

    // Verificăm lista personalizată de excepții a utilizatorului
    if (customExceptions) {
      const lower = word.toLowerCase();
      if (Array.isArray(customExceptions) && customExceptions.some(e => e.toLowerCase() === lower)) {
        return word;
      }
      if (customExceptions instanceof Set && (customExceptions.has(word) || customExceptions.has(lower))) {
        return word;
      }
    }

    // Păstrăm cuvinte care au deja diacritice corecte
    if (/[ăâîșțĂÂÎȘȚ]/.test(word)) {
      return word;
    }

    const clean = stripDiacritics(word).toLowerCase();

    // Verificăm dacă cuvântul este protejat
    if (NEVER_CONVERT.has(clean)) {
      return word;
    }

    // Căutare în dicționarul global
    const dict = (typeof window !== 'undefined' && window.DIACRITICS_DICT) ||
                 (typeof globalThis !== 'undefined' && globalThis.DIACRITICS_DICT) ||
                 (typeof self !== 'undefined' && self.DIACRITICS_DICT) || null;
    if (dict && dict[clean]) {
      return matchCase(word, dict[clean]);
    }

    // Reguli morfologice fallback
    const morphological = applyMorphologicalRules(word);
    if (morphological !== word) {
      return morphological;
    }

    return word;
  }

  // Reguli contextuale (Bigrame & Propoziții)
  function refineSentence(text) {
    if (!text || typeof text !== 'string') return text;

    let res = text;
    res = res.replace(/ş/g, 'ș').replace(/Ş/g, 'Ș').replace(/ţ/g, 'ț').replace(/Ţ/g, 'Ț');

    // 1. Înlocuiri directe de expresii compuse / cratimă
    const HYPHEN_MAP = [
      [/\bintr-o\b/gi, 'într-o'],
      [/\bintr-un\b/gi, 'într-un'],
      [/\bdintr-o\b/gi, 'dintr-o'],
      [/\bdintr-un\b/gi, 'dintr-un'],
      [/\bprintr-o\b/gi, 'printr-o'],
      [/\bprintr-un\b/gi, 'printr-un'],
      [/\bintr-adevar\b/gi, 'într-adevăr'],
      [/\bde-a lungul\b/gi, 'de-a lungul'],
      [/\bde-a dreptul\b/gi, 'de-a dreptul'],
      [/\bsi-a\b/gi, 'și-a'],
      [/\bsi-au\b/gi, 'și-au'],
      [/\bti-a\b/gi, 'ți-a'],
      [/\bti-am\b/gi, 'ți-am'],
      [/\bti-ai\b/gi, 'ți-ai'],
      [/\bti-ati\b/gi, 'ți-ați'],
      [/\bmi-a\b/gi, 'mi-a'],
      [/\bmi-am\b/gi, 'mi-am'],
      [/\bsa-mi\b/gi, 'să-mi'],
      [/\bsa-ti\b/gi, 'să-ți'],
      [/\bsa-si\b/gi, 'să-și'],
      [/\bsa-i\b/gi, 'să-i'],
      [/\bsa-l\b/gi, 'să-l'],
      [/\bsa-ne\b/gi, 'să-ne'],
      [/\bsa-va\b/gi, 'să-vă'],
      [/\bv-ati\b/gi, 'v-ați'],
      [/\ble-ati\b/gi, 'le-ați'],
      [/\bi-ati\b/gi, 'i-ați'],
      [/\bn-aveti\b/gi, 'n-aveți']
    ];

    for (const [pattern, target] of HYPHEN_MAP) {
      res = res.replace(pattern, (match) => matchCase(match, target));
    }

    // 2. "ca" vs "că"
    const CA_PATTERNS = [
      /\b(stiu|știu|cred|credeam|pentru|asa|așa|faptul|dupa ce|după ce|sigur|bine|pare|observ|văd|vad|aratat|arătat|spus|zice|scrie)\s+(ca)\b/gi,
      /\b(clar|evident|posibil|probabil|important)\s+(ca)\b/gi
    ];
    for (const pat of CA_PATTERNS) {
      res = res.replace(pat, (full, prev, ca) => {
        return prev + ' ' + matchCase(ca, 'că');
      });
    }

    res = res.replace(/\b(la fel)\s+(că)\b/gi, (full, prev, ca) => {
      return prev + ' ' + matchCase(ca, 'ca');
    });

    // 3. "sa" vs "să"
    const POSSESSIVE_SA = /\b(casa|mama|tata|sora|familia|soția|sotia|fiica|viata|viața|moartea|voia|parerea|părerea|dorința|dorinta)\s+(să)\b/gi;
    res = res.replace(POSSESSIVE_SA, (full, noun, sa) => {
      return noun + ' ' + matchCase(sa, 'sa');
    });

    const VERBAL_SA = /\b(vrea|trebuie|poate|putem|puteti|puteți|vrut|dorim|fara|fără|incerc|încerc)\s+(sa)\b/gi;
    res = res.replace(VERBAL_SA, (full, verb, sa) => {
      return verb + ' ' + matchCase(sa, 'să');
    });

    // 4. "fata" / "față" / "fată"
    res = res.replace(/\b(in|în)\s+(fata|fată)\b/gi, (full, prep, word) => {
      return prep + ' ' + matchCase(word, 'față');
    });
    res = res.replace(/\b(fata|fată)\s+(de)\b/gi, (full, word, prep) => {
      return matchCase(word, 'față') + ' ' + prep;
    });
    res = res.replace(/\b(fata|fată)\s+(in|în)\s+(fata|fată)\b/gi, (full, w1, prep, w2) => {
      return matchCase(w1, 'față') + ' ' + prep + ' ' + matchCase(w2, 'față');
    });
    res = res.replace(/\b(o)\s+(fata|față)\b/gi, (full, art, word) => {
      return art + ' ' + matchCase(word, 'fată');
    });
    res = res.replace(/\b(fata|față)\s+(frumoasă|draguta|drăguță)\b/gi, (full, word, adj) => {
      return matchCase(word, 'fată') + ' ' + adj;
    });

    // 5. "viata" / "viață" / "viața"
    res = res.replace(/\b(in|în|de|fara|fără)\s+(viata|viața)\b/gi, (full, prep, word) => {
      return prep + ' ' + matchCase(word, 'viață');
    });
    res = res.replace(/\b(viata|viață)\s+(mea|ta|sa|noastra|noastră|voastra|voastră|lui|lor)\b/gi, (full, word, pron) => {
      return matchCase(word, 'viața') + ' ' + pron;
    });
    res = res.replace(/\b(toata|toată)\s+(viata|viață)\b/gi, (full, art, word) => {
      return art + ' ' + matchCase(word, 'viața');
    });

    // 6. "o dată" vs "data viitoare"
    res = res.replace(/\b(o)\s+(data)\b/gi, (full, art, word) => {
      return art + ' ' + matchCase(word, 'dată');
    });
    res = res.replace(/\b(inca|încă)\s+(o)\s+(data|dată)\b/gi, (full, inca, art, word) => {
      return matchCase(inca, 'încă') + ' ' + art + ' ' + matchCase(word, 'dată');
    });

    // 7. "bună ziua"
    res = res.replace(/\b(buna|bună)\s+(ziua)\b/gi, (full, buna, ziua) => {
      return matchCase(buna, 'bună') + ' ' + matchCase(ziua, 'ziua');
    });
    res = res.replace(/\b(o zi)\s+(buna)\b/gi, (full, zi, buna) => {
      return zi + ' ' + matchCase(buna, 'bună');
    });

    return res;
  }

  // Procesare text complet
  function processFullText(text, customExceptions = null) {
    if (!text || typeof text !== 'string') return text;

    const tokens = text.split(/([a-zA-ZăâîșțĂÂÎȘȚ\-]+)/);
    const convertedTokens = tokens.map((tok) => {
      if (/^[a-zA-ZăâîșțĂÂÎȘȚ\-]+$/.test(tok)) {
        return restoreWord(tok, customExceptions);
      }
      return tok;
    });

    let result = convertedTokens.join('');
    result = refineSentence(result);
    return result;
  }

  return {
    stripDiacritics,
    removeDiacritics,
    matchCase,
    isEnglishContext,
    restoreWord,
    refineSentence,
    processFullText
  };
}));
