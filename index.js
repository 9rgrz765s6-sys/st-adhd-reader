const EXT_ID = 'adhd-reader';

const MODES = ['off', 'light', 'medium', 'strong'];
const MODE_LABELS = {
  off: 'OFF',
  light: '轻',
  medium: '中',
  strong: '强',
};

const FOCUS_MODES = ['off', 'soft', 'strong'];
const FOCUS_LABELS = {
  off: '聚焦：关',
  soft: '聚焦：柔',
  strong: '聚焦：强',
};

const COLOR_MODES = ['off', 'soft'];
const COLOR_LABELS = {
  off: '彩色：关',
  soft: '彩色：柔',
};

const LAYOUT_MODES = ['auto', 'compact', 'comfort'];
const LAYOUT_LABELS = {
  auto: '排版：自动',
  compact: '排版：紧凑',
  comfort: '排版：舒展',
};

let mode = localStorage.getItem(`${EXT_ID}-mode`) || 'medium';
if (!MODES.includes(mode)) mode = 'medium';

let focusMode = localStorage.getItem(`${EXT_ID}-focus`) || 'off';
if (!FOCUS_MODES.includes(focusMode)) focusMode = 'off';

let colorMode = localStorage.getItem(`${EXT_ID}-color`) || 'off';
if (!COLOR_MODES.includes(colorMode)) colorMode = 'off';

let layoutMode = localStorage.getItem(`${EXT_ID}-layout`) || 'auto';
if (!LAYOUT_MODES.includes(layoutMode)) layoutMode = 'auto';

let observer = null;
let processing = false;
let pendingTimer = null;
let mountTimer = null;
let fallbackVisible = false;

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
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TD',
  'TH',
  'DETAILS',
  'SUMMARY',
  'SELECT',
  'OPTION',
]);

function isEnabled() {
  return mode !== 'off';
}

function isWhitespaceOrPunctuation(text) {
  return /^[\s。，、！？；：,.!?;:()[\]{}《》“”‘’"'—…·\-]+$/.test(text);
}

function isEnglishWord(token) {
  return /^[A-Za-z0-9][A-Za-z0-9'-]*$/.test(token);
}

function hasCJK(token) {
  return /[\u3400-\u9fff]/.test(token);
}

function countCJK(text) {
  const match = text.match(/[\u3400-\u9fff]/g);
  return match ? match.length : 0;
}

function countLatin(text) {
  const match = text.match(/[A-Za-z]/g);
  return match ? match.length : 0;
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
    if (mode === 'light') {
      if (len <= 4) return 0;
      if (len <= 6) return 2;
      return Math.ceil(len * 0.35);
    }

    if (mode === 'medium') {
      if (len <= 3) return 1;
      if (len <= 5) return 2;
      return Math.ceil(len * 0.42);
    }

    if (mode === 'strong') {
      if (len <= 3) return 1;
      if (len <= 5) return 2;
      return Math.ceil(len * 0.5);
    }
  }

  if (hasCJK(token)) {
    if (mode === 'light') {
      if (len <= 1) return 0;
      if (len <= 4) return 1;
      return 2;
    }

    if (mode === 'medium') {
      if (len <= 1) return 0;
      if (len <= 3) return 1;
      if (len <= 6) return 2;
      return 3;
    }

    if (mode === 'strong') {
      if (len <= 1) return 0;
      if (len <= 2) return 1;
      if (len <= 4) return 2;
      return Math.min(3, Math.ceil(len * 0.45));
    }
  }

  return 0;
}

function getSemanticClass(token) {
  const lower = token.toLowerCase();

  if (
    /爱|喜欢|恨|哭|笑|心|梦|怕|痛|温柔|孤独|命运|希望|绝望|愤怒|难过|快乐|悲伤|焦虑|安心|害怕|幸福|沉默|担心|怜悯|关心|安慰/.test(token) ||
    /love|like|hate|cry|smile|heart|dream|fear|pain|gentle|lonely|fate|hope|despair|angry|sad|anxious|safe|happy|silence|worried|worry|comfort|compassion|concern|caring|afraid|relief|tender|sorrow|grief/.test(lower)
  ) {
    return 'adhd-semantic-emotion';
  }

  if (
    /说|问|看|走|跑|伸|握|抱|吻|低头|抬眼|靠近|离开|推开|转身|停下|颤抖|呼吸|触碰|凝视|醒来|治愈|恢复|寻找|握住|扶起/.test(token) ||
    /say|said|ask|asked|look|walk|run|reach|hold|hug|kiss|breathe|touch|stare|shiver|leave|turn|stop|wake|heal|find|search|clasp|restore|move|step|lean|whisper|watch|open|close/.test(lower)
  ) {
    return 'adhd-semantic-action';
  }

  if (
    /夜|雨|雪|风|光|影|门|窗|房间|街|天空|神殿|世界|声音|颜色|镜头|阳光|黑暗|森林|城市|海|月|冬日|夏天|空气|屏幕/.test(token) ||
    /night|rain|snow|wind|light|shadow|door|window|room|street|sky|forest|city|sea|moon|sun|dark|world|voice|sound|glow|amber|magic|winter|summer|air|screen|garden|river/.test(lower)
  ) {
    return 'adhd-semantic-scene';
  }

  return '';
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
    const semanticClass = getSemanticClass(token);
    wrapper.className = semanticClass ? `adhd-token ${semanticClass}` : 'adhd-token';

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
    if (current.closest?.(`#${EXT_ID}-settings-panel`)) return true;
    if (current.closest?.(`#${EXT_ID}-fallback-bar`)) return true;
    if (current.closest?.(`#${EXT_ID}-ruler`)) return true;
    if (current.closest?.('[data-adhd-skip="true"]')) return true;
    current = current.parentElement;
  }

  return false;
}

function getCleanSignature(element) {
  return (element.innerText || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);
}

function removeReaderMarkup(element) {
  const tokens = element.querySelectorAll('.adhd-token');

  tokens.forEach(token => {
    token.replaceWith(document.createTextNode(token.innerText));
  });

  element.normalize();
}

function getTypographyForText(text) {
  const length = text.length;
  const cjk = countCJK(text);
  const latin = countLatin(text);
  const total = cjk + latin || 1;
  const cjkRatio = cjk / total;
  const width = window.innerWidth || 390;

  let lineHeight;
  let paragraphGap;
  let letterSpacing;
  let wordSpacing;
  let maxWidth;

  if (cjkRatio > 0.55) {
    lineHeight = length > 700 ? 1.88 : length > 350 ? 1.82 : 1.74;
    paragraphGap = length > 700 ? 0.95 : length > 350 ? 0.78 : 0.58;
    letterSpacing = length > 350 ? 0.018 : 0.012;
    wordSpacing = 0.03;
    maxWidth = '72ch';
  } else if (cjkRatio < 0.25) {
    lineHeight = length > 700 ? 1.72 : length > 350 ? 1.66 : 1.58;
    paragraphGap = length > 700 ? 0.82 : length > 350 ? 0.66 : 0.48;
    letterSpacing = 0.006;
    wordSpacing = length > 350 ? 0.075 : 0.055;
    maxWidth = '70ch';
  } else {
    lineHeight = length > 700 ? 1.82 : length > 350 ? 1.76 : 1.66;
    paragraphGap = length > 700 ? 0.88 : length > 350 ? 0.72 : 0.52;
    letterSpacing = 0.012;
    wordSpacing = 0.045;
    maxWidth = '71ch';
  }

  if (width < 430) {
    lineHeight += 0.04;
    paragraphGap += 0.08;
    maxWidth = '100%';
  }

  if (width > 760) {
    lineHeight -= 0.04;
    paragraphGap -= 0.05;
    maxWidth = '76ch';
  }

  if (mode === 'light') lineHeight -= 0.02;

  if (mode === 'strong') {
    lineHeight += 0.03;
    letterSpacing += 0.003;
  }

  if (layoutMode === 'compact') {
    lineHeight -= 0.10;
    paragraphGap -= 0.16;
    letterSpacing -= 0.004;
    wordSpacing -= 0.015;
  }

  if (layoutMode === 'comfort') {
    lineHeight += 0.12;
    paragraphGap += 0.20;
    letterSpacing += 0.006;
    wordSpacing += 0.018;
  }

  lineHeight = Math.max(1.48, Math.min(1.98, lineHeight));
  paragraphGap = Math.max(0.28, Math.min(1.2, paragraphGap));
  letterSpacing = Math.max(0, Math.min(0.032, letterSpacing));
  wordSpacing = Math.max(0, Math.min(0.095, wordSpacing));

  return {
    lineHeight: lineHeight.toFixed(2),
    paragraphGap: `${paragraphGap.toFixed(2)}em`,
    letterSpacing: `${letterSpacing.toFixed(3)}em`,
    wordSpacing: `${wordSpacing.toFixed(3)}em`,
    maxWidth,
  };
}

function applyAdaptiveTypography(element, text) {
  const typography = getTypographyForText(text);

  element.style.setProperty('--adhd-line-height', typography.lineHeight);
  element.style.setProperty('--adhd-paragraph-gap', typography.paragraphGap);
  element.style.setProperty('--adhd-letter-spacing', typography.letterSpacing);
  element.style.setProperty('--adhd-word-spacing', typography.wordSpacing);
  element.style.setProperty('--adhd-max-width', typography.maxWidth);
}

function processElement(element, force = false) {
  if (!element) return;

  const currentSignature = getCleanSignature(element);
  if (!currentSignature) return;

  const alreadyDone = element.dataset.adhdReaderDone === '1';
  const oldSignature = element.dataset.adhdReaderSignature || '';
  const oldMode = element.dataset.adhdReaderMode || '';
  const oldLayout = element.dataset.adhdReaderLayout || '';
  const hasMarkup = Boolean(element.querySelector('.adhd-token'));

  if (
    alreadyDone &&
    (currentSignature !== oldSignature || oldMode !== mode || oldLayout !== layoutMode || !hasMarkup)
  ) {
    restoreElement(element);
  }

  if (!force && element.dataset.adhdReaderDone === '1') {
    applyAdaptiveTypography(element, currentSignature);
    return;
  }

  element.dataset.adhdOriginalHtml = element.innerHTML;
  element.dataset.adhdReaderMode = mode;
  element.dataset.adhdReaderLayout = layoutMode;

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
  element.dataset.adhdReaderMode = mode;
  element.dataset.adhdReaderLayout = layoutMode;
  element.classList.add('adhd-reader-active-text');

  applyAdaptiveTypography(element, currentSignature);
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
  delete element.dataset.adhdReaderMode;
  delete element.dataset.adhdReaderLayout;

  element.classList.remove('adhd-reader-active-text');
  element.style.removeProperty('--adhd-line-height');
  element.style.removeProperty('--adhd-paragraph-gap');
  element.style.removeProperty('--adhd-letter-spacing');
  element.style.removeProperty('--adhd-word-spacing');
  element.style.removeProperty('--adhd-max-width');
}

function getTargetMessages() {
  const all = Array.from(document.querySelectorAll('.mes_text'));

  return all.filter(element => {
    const message = element.closest('.mes');

    if (!message) return true;

    const isUser =
      message.classList.contains('user_mes') ||
      message.getAttribute('is_user') === 'true' ||
      message.dataset?.isUser === 'true';

    return !isUser;
  });
}

function processAllMessages(force = false) {
  if (processing || !isEnabled()) return;

  processing = true;

  try {
    getTargetMessages().forEach(element => {
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
  if (!isEnabled()) return;

  clearTimeout(pendingTimer);

  pendingTimer = setTimeout(() => {
    processAllMessages(force);
  }, 180);
}

function updateBodyClasses() {
  document.body.classList.remove(
    'adhd-reader-mode-off',
    'adhd-reader-mode-light',
    'adhd-reader-mode-medium',
    'adhd-reader-mode-strong',
    'adhd-reader-focus-off',
    'adhd-reader-focus-soft',
    'adhd-reader-focus-strong',
    'adhd-reader-color-off',
    'adhd-reader-color-soft',
    'adhd-reader-layout-auto',
    'adhd-reader-layout-compact',
    'adhd-reader-layout-comfort'
  );

  document.body.classList.add(`adhd-reader-mode-${mode}`);
  document.body.classList.add(`adhd-reader-focus-${focusMode}`);
  document.body.classList.add(`adhd-reader-color-${colorMode}`);
  document.body.classList.add(`adhd-reader-layout-${layoutMode}`);
  document.body.classList.toggle('adhd-reader-enabled', isEnabled());
}

function applyState(force = false) {
  updateBodyClasses();
  updateAllControls();

  if (isEnabled()) {
    processAllMessages(force);
  } else {
    restoreAllMessages();
  }
}

function cycleMode() {
  const currentIndex = MODES.indexOf(mode);
  mode = MODES[(currentIndex + 1) % MODES.length];

  localStorage.setItem(`${EXT_ID}-mode`, mode);

  restoreAllMessages();

  setTimeout(() => {
    applyState(true);
  }, 60);
}

function cycleFocus() {
  const currentIndex = FOCUS_MODES.indexOf(focusMode);
  focusMode = FOCUS_MODES[(currentIndex + 1) % FOCUS_MODES.length];

  localStorage.setItem(`${EXT_ID}-focus`, focusMode);
  applyState(false);
}

function cycleColor() {
  const currentIndex = COLOR_MODES.indexOf(colorMode);
  colorMode = COLOR_MODES[(currentIndex + 1) % COLOR_MODES.length];

  localStorage.setItem(`${EXT_ID}-color`, colorMode);
  applyState(false);
}

function cycleLayout() {
  const currentIndex = LAYOUT_MODES.indexOf(layoutMode);
  layoutMode = LAYOUT_MODES[(currentIndex + 1) % LAYOUT_MODES.length];

  localStorage.setItem(`${EXT_ID}-layout`, layoutMode);

  restoreAllMessages();

  setTimeout(() => {
    applyState(true);
  }, 60);
}

function refreshReader() {
  restoreAllMessages();

  setTimeout(() => {
    applyState(true);

    document.querySelectorAll(`.${EXT_ID}-refresh-button`).forEach(button => {
      button.textContent = '已重刷';
      setTimeout(() => {
        button.textContent = '重刷';
      }, 900);
    });
  }, 80);
}

function resetReader() {
  mode = 'medium';
  focusMode = 'off';
  colorMode = 'off';
  layoutMode = 'auto';

  localStorage.setItem(`${EXT_ID}-mode`, mode);
  localStorage.setItem(`${EXT_ID}-focus`, focusMode);
  localStorage.setItem(`${EXT_ID}-color`, colorMode);
  localStorage.setItem(`${EXT_ID}-layout`, layoutMode);

  restoreAllMessages();

  setTimeout(() => {
    applyState(true);
  }, 80);
}

function findSettingsRoot() {
  const selectors = [
    '#extensions_settings',
    '#extension_settings',
    '#extensions_settings2',
    '#extensions_container',
    '#extensionsMenu',
    '#rm_extensions_block',
    '#extensions_panel',
    '#extensions',
    '.extensions_settings',
    '.extension_settings',
    '.drawer-content',
    '.drawer_content',
    '.drawer-content-body',
    '.inline-drawer-content',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }

  return null;
}

function createControlPanel(id, type = 'settings') {
  const wrapper = document.createElement('div');
  wrapper.id = id;
  wrapper.className = type === 'fallback'
    ? 'adhd-reader-fallback-bar'
    : 'adhd-reader-settings-panel';
  wrapper.dataset.adhdSkip = 'true';

  wrapper.innerHTML = `
    <div class="adhd-reader-settings-title">ADHD Reader</div>
    <div class="adhd-reader-settings-desc">仿生阅读、自动排版、聚焦线与轻量高亮。</div>
    <div class="adhd-reader-settings-buttons">
      <button type="button" class="${EXT_ID}-mode-button">模式</button>
      <button type="button" class="${EXT_ID}-layout-button">排版</button>
      <button type="button" class="${EXT_ID}-focus-button">聚焦</button>
      <button type="button" class="${EXT_ID}-color-button">彩色</button>
      <button type="button" class="${EXT_ID}-refresh-button">重刷</button>
      <button type="button" class="${EXT_ID}-reset-button">重置</button>
    </div>
  `;

  wrapper.querySelector(`.${EXT_ID}-mode-button`)?.addEventListener('click', cycleMode);
  wrapper.querySelector(`.${EXT_ID}-layout-button`)?.addEventListener('click', cycleLayout);
  wrapper.querySelector(`.${EXT_ID}-focus-button`)?.addEventListener('click', cycleFocus);
  wrapper.querySelector(`.${EXT_ID}-color-button`)?.addEventListener('click', cycleColor);
  wrapper.querySelector(`.${EXT_ID}-refresh-button`)?.addEventListener('click', refreshReader);
  wrapper.querySelector(`.${EXT_ID}-reset-button`)?.addEventListener('click', resetReader);

  return wrapper;
}

function updateAllControls() {
  document.querySelectorAll(`.${EXT_ID}-mode-button`).forEach(button => {
    button.textContent = `模式：${MODE_LABELS[mode]}`;
  });

  document.querySelectorAll(`.${EXT_ID}-layout-button`).forEach(button => {
    button.textContent = LAYOUT_LABELS[layoutMode];
  });

  document.querySelectorAll(`.${EXT_ID}-focus-button`).forEach(button => {
    button.textContent = FOCUS_LABELS[focusMode];
  });

  document.querySelectorAll(`.${EXT_ID}-color-button`).forEach(button => {
    button.textContent = COLOR_LABELS[colorMode];
  });
}

function ensureSettingsPanel() {
  if (document.getElementById(`${EXT_ID}-settings-panel`)) {
    updateAllControls();
    return true;
  }

  const root = findSettingsRoot();

  if (!root) return false;

  const panel = createControlPanel(`${EXT_ID}-settings-panel`, 'settings');
  root.prepend(panel);
  updateAllControls();
  return true;
}

function ensureFallbackBar() {
  if (document.getElementById(`${EXT_ID}-fallback-bar`)) {
    updateAllControls();
    return;
  }

  const bar = createControlPanel(`${EXT_ID}-fallback-bar`, 'fallback');

  const title = bar.querySelector('.adhd-reader-settings-title');
  if (title) title.textContent = 'ADHD Reader 通用入口';

  const desc = bar.querySelector('.adhd-reader-settings-desc');
  if (desc) desc.textContent = '未找到扩展设置页，已启用兜底控制条。';

  document.body.appendChild(bar);
  fallbackVisible = true;
  updateAllControls();
}

function mountControls() {
  const mounted = ensureSettingsPanel();

  if (mounted) {
    const fallback = document.getElementById(`${EXT_ID}-fallback-bar`);
    if (fallback) fallback.remove();
    fallbackVisible = false;
    return;
  }

  ensureFallbackBar();
}

function scheduleMountControls() {
  clearTimeout(mountTimer);
  mountTimer = setTimeout(mountControls, 300);
}

function addFocusRuler() {
  if (document.getElementById(`${EXT_ID}-ruler`)) return;

  const ruler = document.createElement('div');
  ruler.id = `${EXT_ID}-ruler`;
  ruler.dataset.adhdSkip = 'true';
  document.body.appendChild(ruler);

  const moveRuler = clientY => {
    if (!isEnabled()) return;
    if (focusMode === 'off') return;

    ruler.style.top = `${clientY - 18}px`;
    ruler.classList.add('adhd-reader-ruler-visible');

    clearTimeout(ruler._hideTimer);
    ruler._hideTimer = setTimeout(() => {
      ruler.classList.remove('adhd-reader-ruler-visible');
    }, 1400);
  };

  document.addEventListener('mousemove', event => {
    moveRuler(event.clientY);
  });

  document.addEventListener(
    'touchmove',
    event => {
      if (event.touches && event.touches[0]) {
        moveRuler(event.touches[0].clientY);
      }
    },
    { passive: true }
  );
}

function observeWholeApp() {
  if (observer) observer.disconnect();

  observer = new MutationObserver(mutations => {
    let shouldProcess = false;
    let shouldMount = false;

    for (const mutation of mutations) {
      const target = mutation.target;

      if (target?.closest?.(`#${EXT_ID}-settings-panel`)) continue;
      if (target?.closest?.(`#${EXT_ID}-fallback-bar`)) continue;
      if (target?.id === `${EXT_ID}-ruler`) continue;

      if (mutation.type === 'childList') {
        shouldMount = true;
        shouldProcess = true;
      }

      if (mutation.type === 'characterData') {
        shouldProcess = true;
      }
    }

    if (shouldMount) scheduleMountControls();

    if (shouldProcess && isEnabled() && !processing) {
      scheduleProcess(false);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function init() {
  mountControls();
  addFocusRuler();
  observeWholeApp();
  applyState(true);

  setTimeout(mountControls, 800);
  setTimeout(mountControls, 1800);
  setTimeout(mountControls, 3500);
}

window.ADHDReaderRefresh = refreshReader;
window.ADHDReaderReset = resetReader;
window.ADHDReaderMount = mountControls;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

setTimeout(init, 800);
setTimeout(() => applyState(true), 1800);
setTimeout(() => applyState(true), 3500);
