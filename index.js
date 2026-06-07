// ADHD Reader V7.8.2
// Bilingual UI Mini Update: Chinese / English UI switch
// Based on V7.8.1 Desktop Width Hotfix

const EXT_ID = 'adhd-reader';

const MODES = ['off', 'light', 'medium', 'strong'];
const FOCUS_MODES = ['off', 'soft', 'strong'];
const COLOR_MODES = ['off', 'soft'];
const LAYOUT_MODES = ['auto', 'compact', 'comfort'];
const UI_LANGS = ['zh', 'en'];

const LABELS = {
  zh: {
    title: 'ADHD Reader',
    desc: '仿生阅读、自动排版、聚焦线与轻量高亮。',
    fallbackTitle: 'ADHD Reader 通用入口',
    fallbackDesc: '未找到扩展设置页，已启用兜底控制条。',

    modePrefix: '模式：',
    layoutPrefix: '',
    focusPrefix: '',
    colorPrefix: '',

    refresh: '重刷',
    refreshed: '已重刷',
    reset: '重置',
    language: '语言：中文',

    modes: {
      off: 'OFF',
      light: '轻',
      medium: '中',
      strong: '强',
    },

    focus: {
      off: '聚焦：关',
      soft: '聚焦：柔',
      strong: '聚焦：强',
    },

    color: {
      off: '彩色：关',
      soft: '彩色：柔',
    },

    layout: {
      auto: '排版：自动',
      compact: '排版：紧凑',
      comfort: '排版：舒展',
    },
  },

  en: {
    title: 'ADHD Reader',
    desc: 'Bionic-style reading, adaptive layout, focus line, and soft highlighting.',
    fallbackTitle: 'ADHD Reader Quick Controls',
    fallbackDesc: 'Extension settings panel was not found. Fallback controls are enabled.',

    modePrefix: 'Mode: ',
    layoutPrefix: 'Layout: ',
    focusPrefix: 'Focus: ',
    colorPrefix: 'Color: ',

    refresh: 'Refresh',
    refreshed: 'Refreshed',
    reset: 'Reset',
    language: 'Language: English',

    modes: {
      off: 'Off',
      light: 'Light',
      medium: 'Medium',
      strong: 'Strong',
    },

    focus: {
      off: 'Off',
      soft: 'Soft',
      strong: 'Strong',
    },

    color: {
      off: 'Off',
      soft: 'Soft',
    },

    layout: {
      auto: 'Auto',
      compact: 'Compact',
      comfort: 'Comfort',
    },
  },
};

let mode = localStorage.getItem(`${EXT_ID}-mode`) || 'medium';
if (!MODES.includes(mode)) mode = 'medium';

let focusMode = localStorage.getItem(`${EXT_ID}-focus`) || 'off';
if (!FOCUS_MODES.includes(focusMode)) focusMode = 'off';

let colorMode = localStorage.getItem(`${EXT_ID}-color`) || 'off';
if (!COLOR_MODES.includes(colorMode)) colorMode = 'off';

let layoutMode = localStorage.getItem(`${EXT_ID}-layout`) || 'auto';
if (!LAYOUT_MODES.includes(layoutMode)) layoutMode = 'auto';

let uiLang = localStorage.getItem(`${EXT_ID}-ui-lang`) || 'zh';
if (!UI_LANGS.includes(uiLang)) uiLang = 'zh';

let observer = null;
let processing = false;
let pendingTimer = null;
let mountTimer = null;
let typographyTimer = null;

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

const CJK_STOP_WORDS = new Set([
  '的', '了', '着', '过', '吗', '呢', '吧', '啊', '呀', '哦', '喔', '嘛', '啦',
  '也', '都', '就', '又', '还', '很', '更', '最', '太', '挺', '真',
  '却', '而', '并', '且', '和', '与', '或', '及', '跟', '同',
  '在', '从', '向', '往', '朝', '被', '把', '让', '给', '对', '比', '为', '于',
  '中', '里', '内', '外', '上', '下', '前', '后', '旁', '边', '间', '处', '时',
  '那', '这', '哪', '某', '每', '各', '其', '该', '此', '彼', '之', '所',
  '才', '便', '只', '仅', '再', '可', '能', '会', '要', '想', '应', '该',
  '是', '有', '没', '无', '不', '非', '已', '将', '曾', '正',
  '他', '她', '它', '我', '你', '您', '们', '谁',
  '什么', '怎么', '怎样', '为什么',
  '不是', '没有', '不能', '不会', '不要',
  '只是', '可是', '但是', '然而', '然后', '于是', '所以', '因为', '如果', '虽然',
  '已经', '正在', '可以', '可能', '应该',
]);

const CJK_WEAK_MODIFIERS = new Set([
  '微微', '轻轻', '缓缓', '慢慢', '稍稍', '略微', '轻微',
  '隐约', '依稀', '似乎', '仿佛', '好像', '像是',
  '几乎', '大概', '或许', '也许', '可能',
  '依旧', '仍然', '终于', '忽然', '突然', '猛地', '顿时', '渐渐',
  '一点', '一点点', '有点', '有些',
  '格外', '格外地', '十分', '非常', '尤其', '更加', '越发', '越加',
  '那么', '这么', '轻声', '低低', '小声', '悄悄', '静静', '默默',
]);

const CJK_ANCHOR_WORDS = new Set([
  '皱起', '蹙起', '挑眉', '抬眼', '垂眼', '低头', '抬头', '回头', '偏头', '侧头',
  '转身', '转头', '靠近', '贴近', '逼近', '远离', '离开', '退开', '后退',
  '停下', '站住', '走近', '走开', '跑来', '跑开',
  '伸手', '收手', '抬手', '垂手', '握住', '抓住', '攥住',
  '抱住', '拥住', '搂住', '推开', '拉开', '拉住', '按住', '扣住',
  '捧起', '托起', '抚摸', '抚过', '擦过', '触碰', '碰到',
  '吻上', '亲吻', '咬住', '贴上', '贴着', '靠着', '靠在',
  '凝视', '注视', '看向', '望向', '盯着', '瞥见', '看见',
  '听见', '听到', '开口', '回答', '询问', '低语', '呢喃', '耳语',
  '轻笑', '苦笑', '冷笑', '哭泣', '啜泣', '哽咽',
  '沉默', '呼吸', '喘息', '颤抖', '发抖', '僵住', '愣住', '怔住',
  '醒来', '睡去', '闭眼', '睁眼', '眨眼', '移开', '躲开', '避开',
  '靠拢', '贴住', '蜷缩', '跪下', '俯身', '弯腰', '低笑', '叹息',

  '眉', '眼', '唇', '手', '血', '泪',
  '眉心', '眉头', '眉眼', '眼睛', '眼眸', '眼底', '眼尾', '眼睫', '睫毛',
  '瞳孔', '视线', '目光', '唇角', '嘴角', '嘴唇', '脸颊', '脸色',
  '耳尖', '耳畔', '指尖', '手指', '手心', '掌心', '手腕', '手臂',
  '肩膀', '胸口', '心口', '心脏', '喉咙', '喉结', '脖颈', '后颈',
  '腰间', '膝盖', '发梢', '长发', '黑发', '白发', '银发',
  '伤口', '血迹', '泪水', '泪痕',

  '爱意', '喜欢', '厌恶', '恐惧', '害怕', '担心', '安心', '痛苦', '难过',
  '悲伤', '愤怒', '恼怒', '慌乱', '紧张', '焦虑', '温柔', '冷淡',
  '冰冷', '灼热', '炽热', '孤独', '寂寞', '绝望', '希望', '怜悯',
  '心疼', '失神', '动摇', '颤栗', '压抑', '克制', '疯狂', '平静',
  '安静', '沉寂', '清醒', '迷茫', '茫然', '疲惫', '虚弱',
  '疼痛', '刺痛', '窒息', '眩晕', '混乱', '柔软', '僵硬', '滚烫', '寒冷',

  '夜', '雨', '雪', '风', '光', '影', '门', '窗', '月', '海',
  '夜色', '雨声', '风声', '雪声', '月光', '灯光', '火光', '阳光',
  '阴影', '黑暗', '昏暗', '明亮', '黄昏', '黎明', '清晨', '深夜',
  '房间', '卧室', '客厅', '走廊', '门口', '窗边', '床边', '桌边',
  '街道', '街角', '城市', '森林', '花园', '庭院', '海边', '雪地',
  '雨幕', '空气', '气息', '声音', '回声', '世界', '神殿', '屏幕', '镜头',
]);

const CJK_SINGLE_ANCHOR_CHARS = new Set([
  '眉', '眼', '唇', '手', '血', '泪', '心',
  '光', '影', '风', '雨', '雪', '夜', '月', '门', '窗', '海', '火', '声',
  '梦', '痛', '怕', '笑', '哭', '吻',
]);

const CJK_IMPORTANT_CHAR_PATTERN =
  /[眼眉唇脸手指腕肩胸心喉颈泪血光影风雨雪夜月声门窗房屋室街城林海梦痛怕笑哭吻冷热暗明]/;

const CJK_ACTION_CHAR_PATTERN =
  /[看望视听说问答走跑转停伸握抱推拉靠贴触吻咬抬低垂颤抖怔愣僵退离]/;

const CJK_DICTIONARY = Array.from(
  new Set([
    ...CJK_ANCHOR_WORDS,
    ...CJK_WEAK_MODIFIERS,
    ...CJK_STOP_WORDS,
  ])
)
  .filter(word => word.length > 1)
  .sort((a, b) => b.length - a.length);

function getLabels() {
  return LABELS[uiLang] || LABELS.zh;
}

function isEnabled() {
  return mode !== 'off';
}

function isCJKChar(char) {
  return /[\u3400-\u9fff]/.test(char);
}

function isPureCJKToken(text) {
  return /^[\u3400-\u9fff]+$/.test(text);
}

function isLatinChar(char) {
  return /[A-Za-z0-9'-]/.test(char);
}

function isWhitespaceOrPunctuation(text) {
  return /^[\s。，、！？；：,.!?;:()[\]{}《》“”‘’"'—…·\-]+$/.test(text);
}

function isSentenceBoundary(text) {
  return /[。！？!?；;：:\n]/.test(text);
}

function isEnglishWord(token) {
  return /^[A-Za-z0-9][A-Za-z0-9'-]*$/.test(token);
}

function countCJK(text) {
  const match = text.match(/[\u3400-\u9fff]/g);
  return match ? match.length : 0;
}

function countLatin(text) {
  const match = text.match(/[A-Za-z]/g);
  return match ? match.length : 0;
}

function findDictionaryMatch(text, index) {
  for (const word of CJK_DICTIONARY) {
    if (text.startsWith(word, index)) {
      return word;
    }
  }

  return '';
}

function splitChineseAggressive(text) {
  const result = [];
  let i = 0;

  while (i < text.length) {
    const single = text[i];

    if (CJK_STOP_WORDS.has(single) || CJK_SINGLE_ANCHOR_CHARS.has(single)) {
      result.push(single);
      i += 1;
      continue;
    }

    const matched = findDictionaryMatch(text, i);

    if (matched) {
      result.push(matched);
      i += matched.length;
      continue;
    }

    const remain = text.length - i;

    if (remain >= 4) {
      result.push(text.slice(i, i + 2));
      i += 2;
    } else if (remain === 3) {
      result.push(text.slice(i, i + 2));
      result.push(text.slice(i + 2));
      break;
    } else if (remain === 2) {
      result.push(text.slice(i, i + 2));
      break;
    } else {
      result.push(single);
      break;
    }
  }

  return result.filter(Boolean);
}

function refineChineseToken(token) {
  if (!isPureCJKToken(token)) return [token];

  if (token.length <= 1) return [token];

  if (
    CJK_STOP_WORDS.has(token) ||
    CJK_WEAK_MODIFIERS.has(token) ||
    CJK_ANCHOR_WORDS.has(token)
  ) {
    return [token];
  }

  if (token.length === 2) {
    const first = token[0];
    const second = token[1];

    if (CJK_STOP_WORDS.has(first) && CJK_SINGLE_ANCHOR_CHARS.has(second)) {
      return [first, second];
    }

    return [token];
  }

  if (token.length <= 4) {
    const parts = splitChineseAggressive(token);

    const hasMeaningfulBoundary = parts.some(part =>
      CJK_ANCHOR_WORDS.has(part) ||
      CJK_WEAK_MODIFIERS.has(part) ||
      CJK_STOP_WORDS.has(part) ||
      (part.length === 1 && CJK_SINGLE_ANCHOR_CHARS.has(part))
    );

    if (parts.length > 1 && hasMeaningfulBoundary) {
      return parts;
    }

    return [token];
  }

  return splitChineseAggressive(token);
}

function refineSegments(segments) {
  const result = [];

  for (const part of segments) {
    if (!part) continue;

    if (isPureCJKToken(part)) {
      result.push(...refineChineseToken(part));
    } else {
      result.push(part);
    }
  }

  return result.filter(Boolean);
}

function fallbackSegmentText(text) {
  const result = [];
  let buffer = '';
  let bufferType = '';

  function flushBuffer() {
    if (!buffer) return;

    if (bufferType === 'cjk') {
      result.push(...splitChineseAggressive(buffer));
    } else if (bufferType === 'latin') {
      result.push(...buffer.split(/(\s+)/g).filter(Boolean));
    } else {
      result.push(buffer);
    }

    buffer = '';
    bufferType = '';
  }

  for (const char of text) {
    if (isCJKChar(char)) {
      if (bufferType && bufferType !== 'cjk') flushBuffer();
      buffer += char;
      bufferType = 'cjk';
      continue;
    }

    if (isLatinChar(char)) {
      if (bufferType && bufferType !== 'latin') flushBuffer();
      buffer += char;
      bufferType = 'latin';
      continue;
    }

    flushBuffer();
    result.push(char);
  }

  flushBuffer();

  return result.filter(Boolean);
}

function segmentText(text) {
  if (!text.trim()) return [text];

  try {
    if (window.Intl && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('zh-Hans', { granularity: 'word' });
      const segmented = Array.from(segmenter.segment(text)).map(item => item.segment);

      const hasChinese = /[\u3400-\u9fff]/.test(text);

      const chineseSegments = segmented.filter(part =>
        /^[\u3400-\u9fff]+$/.test(part)
      );

      const singleChineseSegments = chineseSegments.filter(part =>
        part.length === 1
      );

      const hasVeryLongChineseChunk = chineseSegments.some(part =>
        part.length >= 8
      );

      const tooFewSegments =
        hasChinese &&
        text.length >= 12 &&
        segmented.filter(part => part.trim()).length <= 2;

      const tooManySingleChinese =
        hasChinese &&
        chineseSegments.length >= 8 &&
        singleChineseSegments.length / chineseSegments.length > 0.72;

      if (!hasVeryLongChineseChunk && !tooFewSegments && !tooManySingleChinese) {
        return refineSegments(segmented);
      }
    }
  } catch (error) {
    console.warn('[ADHD Reader] Intl.Segmenter failed, using fallback:', error);
  }

  return fallbackSegmentText(text);
}

function getBoldLength(token) {
  const len = token.length;
  if (len <= 1) return 0;

  if (isEnglishWord(token)) {
    if (mode === 'light') {
      if (len <= 3) return 1;
      if (len <= 5) return 2;
      return Math.min(len - 1, Math.ceil(len * 0.46));
    }

    if (mode === 'medium') {
      if (len <= 3) return 1;
      if (len <= 5) return 2;
      return Math.min(len - 1, Math.ceil(len * 0.55));
    }

    if (mode === 'strong') {
      if (len <= 2) return 1;
      if (len <= 4) return 2;
      return Math.min(len - 1, Math.ceil(len * 0.65));
    }
  }

  return 0;
}

function getSemanticClass(token) {
  const lower = token.toLowerCase();

  if (
    /爱|喜欢|恨|哭|笑|心|梦|怕|痛|温柔|孤独|命运|希望|绝望|愤怒|难过|快乐|悲伤|焦虑|安心|害怕|幸福|沉默|担心|怜悯|关心|安慰|慌乱|紧张|心疼|失神|动摇|压抑|疲惫|疼痛|寂寞|恐惧|灼热|冰冷/.test(token) ||
    /love|like|hate|cry|smile|heart|dream|fear|pain|gentle|lonely|fate|hope|despair|angry|sad|anxious|safe|happy|silence|worried|worry|comfort|compassion|concern|caring|afraid|relief|tender|sorrow|grief/.test(lower)
  ) {
    return 'adhd-semantic-emotion';
  }

  if (
    /说|问|看|走|跑|伸|握|抱|吻|低头|抬眼|靠近|离开|推开|转身|停下|颤抖|呼吸|触碰|凝视|醒来|治愈|恢复|寻找|握住|扶起|皱起|开口|回答|注视|抚摸|亲吻|闭眼|睁眼|垂眼|回头|偏头|侧头|攥住|搂住|拉住|按住/.test(token) ||
    /say|said|ask|asked|look|walk|run|reach|hold|hug|kiss|breathe|touch|stare|shiver|leave|turn|stop|wake|heal|find|search|clasp|restore|move|step|lean|whisper|watch|open|close/.test(lower)
  ) {
    return 'adhd-semantic-action';
  }

  if (
    /夜|雨|雪|风|光|影|门|窗|房间|街|天空|神殿|世界|声音|颜色|镜头|阳光|黑暗|森林|城市|海|月|冬日|夏天|空气|屏幕|灯光|月光|阴影|黄昏|黎明|昏暗|雨声|风声|雪声/.test(token) ||
    /night|rain|snow|wind|light|shadow|door|window|room|street|sky|forest|city|sea|moon|sun|dark|world|voice|sound|glow|amber|magic|winter|summer|air|screen|garden|river/.test(lower)
  ) {
    return 'adhd-semantic-scene';
  }

  return '';
}

function getChineseAnchorWeight(token) {
  if (!token || !isPureCJKToken(token)) return 0;

  if (CJK_STOP_WORDS.has(token)) return 0;
  if (CJK_WEAK_MODIFIERS.has(token)) return 0;

  if (CJK_ANCHOR_WORDS.has(token)) return 4;
  if (token.length === 1 && CJK_SINGLE_ANCHOR_CHARS.has(token)) return 4;

  const semanticClass = getSemanticClass(token);
  if (semanticClass) return 3;

  if (token.length >= 3) {
    if (CJK_IMPORTANT_CHAR_PATTERN.test(token)) return 2;
    if (CJK_ACTION_CHAR_PATTERN.test(token)) return 2;

    if (mode === 'medium' || mode === 'strong') return 1;
    return 0;
  }

  if (token.length === 2) {
    if (CJK_IMPORTANT_CHAR_PATTERN.test(token)) return 2;
    if (CJK_ACTION_CHAR_PATTERN.test(token)) return 2;

    if (mode === 'light' || mode === 'medium' || mode === 'strong') return 1;
  }

  return 0;
}

function createChineseAnchorState() {
  return {
    anchorsInSentence: 0,
    tokensSinceAnchor: 99,
  };
}

function resetChineseAnchorState(state) {
  state.anchorsInSentence = 0;
  state.tokensSinceAnchor = 99;
}

function canRenderChineseAnchor(token, state, weight) {
  if (weight <= 0) return false;

  const maxAnchors =
    mode === 'light' ? 8 :
    mode === 'medium' ? 13 :
    24;

  if (state.anchorsInSentence >= maxAnchors) return false;

  if (weight >= 4) return true;

  if (mode === 'light') {
    if (weight >= 3) return true;
    if (weight === 2) return state.tokensSinceAnchor >= 1;
    if (weight === 1) return state.tokensSinceAnchor >= 2;
  }

  if (mode === 'medium') {
    if (weight >= 2) return true;
    if (weight === 1) return state.tokensSinceAnchor >= 1;
  }

  if (mode === 'strong') {
    if (weight >= 2) return true;
    if (weight === 1) return true;
  }

  return false;
}

function getChineseBoldLength(token, weight) {
  const len = token.length;
  if (len <= 0) return 0;

  if (len === 1) {
    return weight >= 4 ? 1 : 0;
  }

  if (len === 2) {
    return 1;
  }

  if (weight >= 4) {
    if (mode === 'strong') return Math.min(3, len - 1);
    if (mode === 'medium') return Math.min(2, len - 1);
    return 1;
  }

  if (weight >= 2) {
    if (mode === 'strong') return Math.min(2, len - 1);
    return 1;
  }

  if (weight === 1) {
    return 1;
  }

  return 0;
}

function appendReadableToken(fragment, token, cut, allowWhole = false) {
  if (cut <= 0) {
    fragment.appendChild(document.createTextNode(token));
    return;
  }

  if (cut >= token.length && !allowWhole) {
    fragment.appendChild(document.createTextNode(token));
    return;
  }

  const wrapper = document.createElement('span');
  const semanticClass = getSemanticClass(token);
  wrapper.className = semanticClass ? `adhd-token ${semanticClass}` : 'adhd-token';

  const bold = document.createElement('span');
  bold.className = 'adhd-bold';
  bold.textContent = token.slice(0, cut);
  wrapper.appendChild(bold);

  if (cut < token.length) {
    const rest = document.createElement('span');
    rest.className = 'adhd-rest';
    rest.textContent = token.slice(cut);
    wrapper.appendChild(rest);
  }

  fragment.appendChild(wrapper);
}

function createReadableFragment(text) {
  const fragment = document.createDocumentFragment();
  const tokens = segmentText(text);
  const cjkState = createChineseAnchorState();

  for (const token of tokens) {
    if (!token) continue;

    if (!token.trim() || isWhitespaceOrPunctuation(token)) {
      fragment.appendChild(document.createTextNode(token));

      if (isSentenceBoundary(token)) {
        resetChineseAnchorState(cjkState);
      }

      continue;
    }

    if (isPureCJKToken(token)) {
      const weight = getChineseAnchorWeight(token);
      const shouldAnchor = canRenderChineseAnchor(token, cjkState, weight);
      const cut = shouldAnchor ? getChineseBoldLength(token, weight) : 0;

      if (shouldAnchor && cut > 0) {
        appendReadableToken(fragment, token, cut, token.length === 1);
        cjkState.anchorsInSentence += 1;
        cjkState.tokensSinceAnchor = 0;
      } else {
        fragment.appendChild(document.createTextNode(token));
        cjkState.tokensSinceAnchor += 1;
      }

      continue;
    }

    const cut = getBoldLength(token);

    if (cut <= 0 || cut >= token.length) {
      fragment.appendChild(document.createTextNode(token));
      continue;
    }

    appendReadableToken(fragment, token, cut, false);
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

  if (width > 1024) {
    lineHeight -= 0.04;
    paragraphGap -= 0.05;

    if (layoutMode === 'compact') {
      maxWidth = '112ch';
    } else if (layoutMode === 'comfort') {
      maxWidth = '80ch';
    } else {
      maxWidth = '96ch';
    }
  }

  if (mode === 'light') {
    lineHeight -= 0.02;
  }

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

function markSeenTime(element, currentSignature) {
  const oldSeenSignature = element.dataset.adhdSeenSignature || '';

  if (oldSeenSignature !== currentSignature) {
    element.dataset.adhdSeenSignature = currentSignature;
    element.dataset.adhdSeenAt = String(Date.now());
  }
}

function isMessageGenerating(element) {
  const message = element.closest('.mes');
  if (!message) return false;

  const text = element.innerText || '';

  const hasStreamingClass =
    message.classList.contains('mes_being_generated') ||
    message.classList.contains('typing') ||
    message.classList.contains('streaming');

  const hasStopButton =
    document.querySelector('#mes_stop[style*="display: block"], #send_but[disabled], .fa-stop');

  const seenAt = Number(element.dataset.adhdSeenAt || 0);
  const tooFresh = seenAt > 0 && Date.now() - seenAt < 900;

  return (hasStreamingClass && hasStopButton) || tooFresh || text.endsWith('▌');
}

function safeResetElement(element) {
  if (!element) return;

  removeReaderMarkup(element);

  delete element.dataset.adhdOriginalHtml;
  delete element.dataset.adhdReaderDone;
  delete element.dataset.adhdReaderSignature;
  delete element.dataset.adhdReaderMode;
  delete element.dataset.adhdReaderLayout;

  element.classList.remove('adhd-reader-active-text');
}

function processElement(element, force = false) {
  if (!element) return;

  const currentSignature = getCleanSignature(element);
  if (!currentSignature) return;

  markSeenTime(element, currentSignature);

  if (isMessageGenerating(element)) {
    scheduleProcess(true);
    return;
  }

  const alreadyDone = element.dataset.adhdReaderDone === '1';
  const oldSignature = element.dataset.adhdReaderSignature || '';
  const oldMode = element.dataset.adhdReaderMode || '';
  const hasMarkup = Boolean(element.querySelector('.adhd-token'));

  if (
    alreadyDone &&
    (currentSignature !== oldSignature || oldMode !== mode || !hasMarkup)
  ) {
    safeResetElement(element);
  }

  if (!force && element.dataset.adhdReaderDone === '1') {
    applyAdaptiveTypography(element, currentSignature);
    element.dataset.adhdReaderLayout = layoutMode;
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

  safeResetElement(element);

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

function updateTypographyOnly() {
  if (!isEnabled()) return;

  clearTimeout(typographyTimer);

  typographyTimer = setTimeout(() => {
    getTargetMessages().forEach(element => {
      const text = getCleanSignature(element);
      if (!text) return;

      applyAdaptiveTypography(element, text);
      element.dataset.adhdReaderLayout = layoutMode;
    });
  }, 80);
}

function scheduleProcess(force = false) {
  clearTimeout(pendingTimer);

  pendingTimer = setTimeout(() => {
    if (isEnabled()) {
      processAllMessages(force);
    }
  }, force ? 1100 : 450);
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
    'adhd-reader-layout-comfort',
    'adhd-reader-ui-zh',
    'adhd-reader-ui-en'
  );

  document.body.classList.add(`adhd-reader-mode-${mode}`);
  document.body.classList.add(`adhd-reader-focus-${focusMode}`);
  document.body.classList.add(`adhd-reader-color-${colorMode}`);
  document.body.classList.add(`adhd-reader-layout-${layoutMode}`);
  document.body.classList.add(`adhd-reader-ui-${uiLang}`);
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

  updateBodyClasses();
  updateAllControls();
}

function cycleColor() {
  const currentIndex = COLOR_MODES.indexOf(colorMode);
  colorMode = COLOR_MODES[(currentIndex + 1) % COLOR_MODES.length];

  localStorage.setItem(`${EXT_ID}-color`, colorMode);

  updateBodyClasses();
  updateAllControls();
}

function cycleLayout() {
  const currentIndex = LAYOUT_MODES.indexOf(layoutMode);
  layoutMode = LAYOUT_MODES[(currentIndex + 1) % LAYOUT_MODES.length];

  localStorage.setItem(`${EXT_ID}-layout`, layoutMode);

  updateBodyClasses();
  updateAllControls();
  updateTypographyOnly();
}

function cycleLanguage() {
  const currentIndex = UI_LANGS.indexOf(uiLang);
  uiLang = UI_LANGS[(currentIndex + 1) % UI_LANGS.length];

  localStorage.setItem(`${EXT_ID}-ui-lang`, uiLang);

  updateBodyClasses();
  updateAllControls();
}

function refreshReader() {
  const labels = getLabels();

  restoreAllMessages();

  setTimeout(() => {
    document.querySelectorAll('.mes_text').forEach(element => {
      delete element.dataset.adhdSeenAt;
      delete element.dataset.adhdSeenSignature;
    });

    applyState(true);

    document.querySelectorAll(`.${EXT_ID}-refresh-button`).forEach(button => {
      button.textContent = labels.refreshed;
      setTimeout(() => {
        button.textContent = getLabels().refresh;
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
  wrapper.dataset.adhdPanelType = type;

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
      <button type="button" class="${EXT_ID}-lang-button">语言</button>
    </div>
  `;

  wrapper.querySelector(`.${EXT_ID}-mode-button`)?.addEventListener('click', cycleMode);
  wrapper.querySelector(`.${EXT_ID}-layout-button`)?.addEventListener('click', cycleLayout);
  wrapper.querySelector(`.${EXT_ID}-focus-button`)?.addEventListener('click', cycleFocus);
  wrapper.querySelector(`.${EXT_ID}-color-button`)?.addEventListener('click', cycleColor);
  wrapper.querySelector(`.${EXT_ID}-refresh-button`)?.addEventListener('click', refreshReader);
  wrapper.querySelector(`.${EXT_ID}-reset-button`)?.addEventListener('click', resetReader);
  wrapper.querySelector(`.${EXT_ID}-lang-button`)?.addEventListener('click', cycleLanguage);

  return wrapper;
}

function updatePanelTexts() {
  const labels = getLabels();

  document
    .querySelectorAll('.adhd-reader-settings-panel, .adhd-reader-fallback-bar')
    .forEach(panel => {
      const isFallback =
        panel.id === `${EXT_ID}-fallback-bar` ||
        panel.dataset.adhdPanelType === 'fallback';

      const title = panel.querySelector('.adhd-reader-settings-title');
      const desc = panel.querySelector('.adhd-reader-settings-desc');

      if (title) {
        title.textContent = isFallback ? labels.fallbackTitle : labels.title;
      }

      if (desc) {
        desc.textContent = isFallback ? labels.fallbackDesc : labels.desc;
      }
    });
}

function updateAllControls() {
  const labels = getLabels();

  updatePanelTexts();

  document.querySelectorAll(`.${EXT_ID}-mode-button`).forEach(button => {
    button.textContent = `${labels.modePrefix}${labels.modes[mode]}`;
  });

  document.querySelectorAll(`.${EXT_ID}-layout-button`).forEach(button => {
    if (uiLang === 'en') {
      button.textContent = `${labels.layoutPrefix}${labels.layout[layoutMode]}`;
    } else {
      button.textContent = labels.layout[layoutMode];
    }
  });

  document.querySelectorAll(`.${EXT_ID}-focus-button`).forEach(button => {
    if (uiLang === 'en') {
      button.textContent = `${labels.focusPrefix}${labels.focus[focusMode]}`;
    } else {
      button.textContent = labels.focus[focusMode];
    }
  });

  document.querySelectorAll(`.${EXT_ID}-color-button`).forEach(button => {
    if (uiLang === 'en') {
      button.textContent = `${labels.colorPrefix}${labels.color[colorMode]}`;
    } else {
      button.textContent = labels.color[colorMode];
    }
  });

  document.querySelectorAll(`.${EXT_ID}-refresh-button`).forEach(button => {
    button.textContent = labels.refresh;
  });

  document.querySelectorAll(`.${EXT_ID}-reset-button`).forEach(button => {
    button.textContent = labels.reset;
  });

  document.querySelectorAll(`.${EXT_ID}-lang-button`).forEach(button => {
    button.textContent = labels.language;
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

  document.body.appendChild(bar);
  updateAllControls();
}

function mountControls() {
  const mounted = ensureSettingsPanel();

  if (mounted) {
    const fallback = document.getElementById(`${EXT_ID}-fallback-bar`);
    if (fallback) fallback.remove();
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

  setTimeout(() => {
    applyState(true);
  }, 900);

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
setTimeout(() => {
  scheduleProcess(true);
}, 2500);
