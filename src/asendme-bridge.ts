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
      lastTextAt = Date.now();
      lastCopied = String(text ?? '');
      return original(text);
    };
  }
  document.addEventListener('copy', () => {
    const selected = window.getSelection()?.toString();
    if (selected) lastCopied = selected;
  });

  // Remember the file a tool just offered for download so it can be sent instead.
  const MAX_FILE_BYTES = 50 * 1024 * 1024;
  let lastFile: { file: File; at: number } | null = null;
  let lastTextAt = 0;
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function patchedClick(this: HTMLAnchorElement) {
    const { href, download } = this;
    if (download && /^(blob:|data:)/.test(href)) {
      fetch(href).then(r => r.blob()).then((blob) => {
        if (blob.size > 0 && blob.size <= MAX_FILE_BYTES) {
          lastFile = { file: new File([blob], download, { type: blob.type }), at: Date.now() };
        }
      }).catch(() => { /* download still proceeds */ });
    }
    return originalClick.call(this);
  };
  document.addEventListener('copy', () => { lastTextAt = Date.now(); });

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
    const picked = (window.getSelection()?.toString() || '').trim();
    if (lastFile && !picked && lastFile.at >= lastTextAt) {
      window.parent.postMessage({ type: 'asendme:send-file', file: lastFile.file }, window.location.origin);
      say(`Choose who receives ${lastFile.file.name}\u2026`);
      return;
    }
    const text = (picked || selection || lastCopied).trim();
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
