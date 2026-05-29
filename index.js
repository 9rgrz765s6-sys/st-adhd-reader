const EXT_ID = 'adhd-reader';

let enabled = localStorage.getItem(`${EXT_ID}-enabled`) !== 'false';
let observer = null;
let processing = false;
let pendingTimer = null;

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

  return text
    .split(/(\s+|[。，、！？；：,.!?;:()[\]{}《》“”‘’"'—…·\-])/g)
    .filter(Boolean);
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

function getCleanSignature(element) {
  return (element.innerText || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function removeReaderMarkup(element) {
  const tokens = element.querySelectorAll('.adhd-token');

  tokens.forEach(token => {
    const text = document.createTextNode(token.innerText);
    token.replaceWith(text);
  });

  element.normalize();
}

function processElement(element, force = false) {
  if (!element) return;

  const currentSignature = getCleanSignature(element);
  if (!currentSignature) return;

  const alreadyDone = element.dataset.adhdReaderDone === '1';
  const oldSignature = element.dataset.adhdReaderSignature || '';
  const hasMarkup = Boolean(element.querySelector('.adhd-token'));

  // 角色/聊天切换后，酒馆可能复用 DOM：
  // dataset 还在，但正文已经变了，所以必须重置。
  if (alreadyDone && (currentSignature !== oldSignature || !hasMarkup)) {
    delete element.dataset.adhdReaderDone;
    delete element.dataset.adhdReaderSignature;
    delete element.dataset.adhdOriginalHtml;
    removeReaderMarkup(element);
  }

  if (!force && element.dataset.adhdReaderDone === '1') return;

  // 保存当前原始 HTML。注意：这里保存的是“当前角色/当前消息”的原文。
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
  element.dataset.adhdReaderSignature = getCleanSignature(element);
  element.classList.add('adhd-reader-active-text');
}

function restoreElement(element) {
  if (!element) return;

  const originalHtml = element.dataset.adhdOriginalHtml;

  if (originalHtml) {
    element.innerHTML = originalHtml;
  } else {
    removeReaderMarkup(element);
  }

  delete element.dataset.adhdOriginalHtml;
  delete element.dataset.adhdReaderDone;
  delete element.dataset.adhdReaderSignature;
  element.classList.remove('adhd-reader-active-text');
}

function processAllMessages(force = false) {
  if (processing) return;

  processing = true;

  try {
    document.querySelectorAll('.mes_text').forEach(element => {
      processElement(element, force);
    });
  } finally {
    processing = false;
  }
}

function restoreAllMessages() {
  if (processing) return;

  processing = true;

  try {
    document.querySelectorAll('.mes_text').forEach(restoreElement);
  } finally {
    processing = false;
  }
}

function scheduleProcess(force = false) {
  if (!enabled) return;

  clearTimeout(pendingTimer);

  pendingTimer = setTimeout(() => {
    processAllMessages(force);
  }, 180);
}

function applyState(force = false) {
  document.body.classList.toggle('adhd-reader-enabled', enabled);

  const button = document.getElementById(`${EXT_ID}-floating-toggle`);
  if (button) {
    button.textContent = enabled ? 'ADHD ON' : 'ADHD OFF';
    button.classList.toggle('adhd-reader-button-on', enabled);
  }

  if (enabled) {
    processAllMessages(force);
  } else {
    restoreAllMessages();
  }
}

function addFloatingButton() {
  let button = document.getElementById(`${EXT_ID}-floating-toggle`);

  if (!button) {
    button = document.createElement('button');
    button.id = `${EXT_ID}-floating-toggle`;
    button.type = 'button';

    button.addEventListener('click', () => {
      enabled = !enabled;
      localStorage.setItem(`${EXT_ID}-enabled`, String(enabled));

      // 点按钮时强制刷新，防止后台换角色后状态不同步。
      applyState(true);
    });

    document.body.appendChild(button);
  }

  button.textContent = enabled ? 'ADHD ON' : 'ADHD OFF';
  button.classList.toggle('adhd-reader-button-on', enabled);
}

function observeWholeApp() {
  if (observer) observer.disconnect();

  observer = new MutationObserver(mutations => {
    if (!enabled || processing) return;

    let shouldProcess = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        shouldProcess = true;
        break;
      }

      if (mutation.type === 'characterData') {
        shouldProcess = true;
        break;
      }
    }

    if (shouldProcess) {
      scheduleProcess(false);
    }
  });

  // 不只监听 #chat，因为 TauriTavern 切换角色时可能整个聊天区域被替换。
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function init() {
  addFloatingButton();
  observeWholeApp();
  applyState(true);
}

// 暴露一个调试入口，万一卡住可以在控制台调用。
// 手机端一般用不到，但留着不影响。
window.ADHDReaderRefresh = function () {
  applyState(true);
};

window.ADHDReaderReset = function () {
  restoreAllMessages();
  setTimeout(() => applyState(true), 100);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

setTimeout(init, 800);
setTimeout(() => applyState(true), 1800);
setTimeout(() => applyState(true), 3500);
