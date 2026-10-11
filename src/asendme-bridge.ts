// ASENDME integration (modifications to the upstream project, GPL-3.0).
// Tools run inside an ASENDME sheet; this lets the user hand a result to the
// ASENDME "send to nearby" flow. Nothing leaves the page except a same-origin
// postMessage to the embedding ASENDME window.

const embedded = () => window.parent !== window;

export function installAsendmeBridge() {
  const params = new URLSearchParams(window.location.search);
  const theme = params.get('theme');
  if (theme === 'dark' || theme === 'light') {
    try {
      localStorage.setItem('vueuse-color-scheme', theme);
    }
    catch { /* storage unavailable */ }
  }

  if (!embedded()) return;
  document.documentElement.classList.add('asendme-embed');

  let lastCopied = '';
  const clipboard = navigator.clipboard;
  if (clipboard?.writeText) {
    const original = clipboard.writeText.bind(clipboard);
    clipboard.writeText = (text: string) => {
      lastCopied = String(text ?? '');
      return original(text);
    };
  }
  document.addEventListener('copy', () => {
    const selected = window.getSelection()?.toString();
    if (selected) lastCopied = selected;
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'asendme-send';
  button.setAttribute('data-testid', 'tools-send-nearby');
  button.textContent = 'Send to nearby';
  const hint = document.createElement('div');
  hint.className = 'asendme-send-hint';
  hint.setAttribute('role', 'status');

  let hintTimer: number | undefined;
  const say = (message: string) => {
    hint.textContent = message;
    hint.dataset.show = 'true';
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => { hint.dataset.show = 'false'; }, 2800);
  };

  // Keep the selection alive when the button takes focus.
  let selection = '';
  document.addEventListener('selectionchange', () => {
    const text = window.getSelection()?.toString() ?? '';
    if (text.trim()) selection = text;
  });
  button.addEventListener('mousedown', e => e.preventDefault());

  button.addEventListener('click', () => {
    const text = (window.getSelection()?.toString() || selection || lastCopied).trim();
    if (!text) {
      say('Select text, or press a tool\u2019s copy button, then tap Send to nearby.');
      return;
    }
    window.parent.postMessage({ type: 'asendme:send-text', text: text.slice(0, 20000) }, window.location.origin);
    say('Choose who receives it\u2026');
  });

  const mount = () => document.body.append(button, hint);
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}
