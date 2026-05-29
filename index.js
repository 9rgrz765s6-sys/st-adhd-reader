const EXT_ID = 'adhd-reader';

let enabled = localStorage.getItem(`${EXT_ID}-enabled`) !== 'false';

function applyState() {
  document.body.classList.toggle('adhd-reader-enabled', enabled);

  const button = document.getElementById(`${EXT_ID}-toggle`);
  if (button) {
    button.textContent = enabled ? 'ADHD Reader: ON' : 'ADHD Reader: OFF';
  }
}

function addButton() {
  if (document.getElementById(`${EXT_ID}-toggle`)) return;

  const button = document.createElement('div');
  button.id = `${EXT_ID}-toggle`;
  button.className = 'menu_button';
  button.textContent = 'ADHD Reader: ON';

  button.addEventListener('click', () => {
    enabled = !enabled;
    localStorage.setItem(`${EXT_ID}-enabled`, String(enabled));
    applyState();
  });

  const menu = document.getElementById('extensionsMenu');
  if (menu) {
    menu.appendChild(button);
  }
}

jQuery(() => {
  addButton();
  applyState();
});
