const EXT_ID = 'adhd-reader';

let enabled = localStorage.getItem(`${EXT_ID}-enabled`) !== 'false';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function splitIntoReadableChunks(text) {
  const clean = text
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const rawParts = clean
    .split(/(?<=[。！？!?；;：:])\s*/g)
    .map(s => s.trim())
    .filter(Boolean);

  const chunks = [];
  let buffer = '';

  for (const part of rawParts) {
    if ((buffer + part).length > 70) {
      if (buffer) chunks.push(buffer.trim());
      buffer = part;
    } else {
      buffer += part;
    }
  }

  if (buffer.trim()) chunks.push(buffer.trim());

  return chunks;
}

function highlightAnchor(text) {
  const safe = escapeHtml(text);

  if (safe.length <= 8) {
    return `<span class="adhd-reader-anchor">${safe}</span>`;
  }

  const anchorLength = Math.min(8, Math.ceil(safe.length * 0.18));
  return `<span class="adhd-reader-anchor">${safe.slice(0, anchorLength)}</span>${safe.slice(anchorLength)}`;
}

function makeReadableHtml(text) {
  const chunks = splitIntoReadableChunks(text);

  return chunks
    .map((chunk, index) => {
      return `
        <div class="adhd-reader-block">
          <span class="adhd-reader-index">${index + 1}</span>
          <span class="adhd-reader-line">${highlightAnchor(chunk)}</span>
        </div>
      `;
    })
    .join('');
}

function processMessage(messageElement) {
  if (!enabled) return;
  if (!messageElement) return;
  if (messageElement.dataset.adhdReaderDone === '1') return;

  const textElement = messageElement.querySelector('.mes_text');
  if (!textElement) return;

  const originalText = textElement.innerText;
  if (!originalText.trim()) return;

  textElement.dataset.adhdOriginalHtml = textElement.innerHTML;
  textElement.innerHTML = makeReadableHtml(originalText);

  messageElement.classList.add('adhd-reader-processed');
  messageElement.dataset.adhdReaderDone = '1';
}

function restoreMessage(messageElement) {
  if (!messageElement) return;

  const textElement = messageElement.querySelector('.mes_text');
  if (!textElement) return;

  const originalHtml = textElement.dataset.adhdOriginalHtml;
  if (!originalHtml) return;

  textElement.innerHTML = originalHtml;

  delete textElement.dataset.adhdOriginalHtml;
  delete messageElement.dataset.adhdReaderDone;
  messageElement.classList.remove('adhd-reader-processed');
}

function processAllMessages() {
  document.querySelectorAll('.mes').forEach(processMessage);
}

function restoreAllMessages() {
  document.querySelectorAll('.mes').forEach(restoreMessage);
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
      setTimeout(processAllMessages, 80);
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
