const EXT_ID = 'adhd-reader';

let enabled = localStorage.getItem(`${EXT_ID}-enabled`) !== 'false';

function applyState() {
  document.body.classList.toggle('adhd-reader-enabled', enabled);

  const button = document.getElementById(`${EXT_ID}-floating-toggle`);
  if (button) {
    button.textContent = enabled ? 'ADHD ON' : 'ADHD OFF';
    button.classList.toggle('adhd-reader-button-on', enabled);
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

function init() {
  addFloatingButton();
  applyState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

setTimeout(init, 1000);
setTimeout(init, 3000);
