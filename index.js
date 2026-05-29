const EXT_ID = 'adhd-reader';

let enabled = localStorage.getItem(`${EXT_ID}-enabled`) !== 'false';

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'TEXTAREA',
  'INPUT',
  'BUTTON',
  'CODE',
  'PRE',
  'KBD',
  'SAMP',
]);

function isWhitespaceOrPunctuation(text) {
  return /^[\s。，、！？；：,.!?;:()[\]{}《》“”‘’"'—…·\-]+$/.test(text);
}

function isEnglishWord(token) {
  return /^[A-Za-z0-9][A-Za-z0-9'-]*$/.test(token);
}

function hasCJK(token) {
  return /[\u3400-\u9fff]/.test(token);
}

function segmentText(text) {
  if (!text.trim()) return [text];

  try {
    if (window.Intl && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('zh-Hans', { granularity: 'word' });
      return Array.from(segmenter.segment(text)).map(item => item.segment);
    }
  } catch (error) {
    console.warn('[ADHD Reader] Segmenter failed:', error);
  }

  return text.split(/(\s+|[。，、！？；：,.!?;:()[\]{}《》“”‘’"'—…·\-])/g).filter(Boolean);
}

function getBoldLength(token) {
  const len = token.length;

  if (len <= 1) return 0;

  if (isEnglishWord(token)) {
    if (len <= 3) return 1;
    if (len <= 5) return 2;
    return Math.ceil(len * 0.42);
  }

  if (hasCJK(token)) {
    if (len <= 2) return 1;
    if (len <= 4) return 1;
    return 2;
  }

  return 0;
}

function createReadableFragment(text) {
  const fragment = document.createDocumentFragment();
  const tokens = segmentText(text);

  for (const token of tokens) {
    if (!token) continue;

    if (!token.trim() || isWhitespaceOrPunctuation(token)) {
      fragment.appendChild(document.createTextNode(token));
      continue;
    }

    const cut = getBoldLength(token);

    if (cut <= 0 || cut >= token.length) {
      fragment.appendChild(document.createTextNode(token));
      continue;
    }

    const wrapper = document.createElement('span');
    wrapper.className = 'adhd-token';

    const bold = document.createElement('span');
    bold.className = 'adhd-bold';
    bold.textContent = token.slice(0, cut);

    const rest = document.createElement('span');
    rest.className = 'adhd-rest';
    rest.textContent = token.slice(cut);

    wrapper.appendChild(bold);
    wrapper.appendChild(rest);
    fragment.appendChild(wrapper);
  }

  return fragment;
}

function shouldSkipTextNode(node) {
  if (!node || !node.parentElement) return true;

  let current = node.parentElement;

  while (current) {
    if (SKIP_TAGS.has(current.tagName)) return true;
    if (current.classList?.contains('adhd-token')) return true;
    if (current.id === `${EXT_ID}-floating-toggle`) return true;
    current = current.parentElement;
  }

  return false;
}

function processElement(element) {
  if (!element) return;
  if (element.dataset.adhdReaderDone === '1') return;

  element.dataset.adhdOriginalHtml = element.innerHTML;

  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (shouldSkipTextNode(node)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  for (const node of textNodes) {
    const fragment = createReadableFragment(node.nodeValue);
    node.parentNode.replaceChild(fragment, node);
  }

  element.dataset.adhdReaderDone = '1';
  element.classList.add('adhd-reader-active-text');
}

function restoreElement(element) {
  if (!element) return;

  const originalHtml = element.dataset.adhdOriginalHtml;
  if (!originalHtml) return;

  element.innerHTML = originalHtml;
  delete element.dataset.adhdOriginalHtml;
  delete element.dataset.adhdReaderDone;
  element.classList.remove('adhd-reader-active-text');
}

function processAllMessages() {
  document.querySelectorAll('.mes_text').forEach(processElement);
}

function restoreAllMessages() {
  document.querySelectorAll('.mes_text').forEach(restoreElement);
}

function applyState() {
  document.body.classList.toggle('adhd-reader-enabled', enabled);

  const button = document.getElementById(`${EXT_ID}-floating-toggle`);
  if (button) {
    button.textContent = enabled ? 'ADHD ON' : 'ADHD OFF';
    button.classList.toggle('adhd-reader-button-on', enabled);
  }

  if (enabled) {
    processAllMessages();
  } else {
    restoreAllMessages();
  }
}

function addFloatingButton() {
  if (document.getElementById(`${EXT_ID}-floating-toggle`)) return;

  const button = document.createElement('button');
  button.id = `${EXT_ID}-floating-toggle`;
  button.type = 'button';
  button.textContent = 'ADHD ON';

  button.addEventListener('click', () => {
    enabled = !enabled;
    localStorage.setItem(`${EXT_ID}-enabled`, String(enabled));
    applyState();
  });

  document.body.appendChild(button);
}

function observeNewMessages() {
  const chat = document.getElementById('chat');
  if (!chat) return;

  const observer = new MutationObserver(() => {
    if (enabled) {
      setTimeout(processAllMessages, 120);
    }
  });

  observer.observe(chat, {
    childList: true,
    subtree: true,
  });
}

function init() {
  addFloatingButton();
  applyState();
  observeNewMessages();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

setTimeout(init, 1000);
setTimeout(init, 3000);
