// ASENDME integration (modifications to the upstream project, GPL-3.0).
// Tools run inside an ASENDME sheet; this lets the user hand a result to the
// ASENDME "send to nearby" flow. Nothing leaves the page except a same-origin
// postMessage to the embedding ASENDME window.

const embedded = () => window.parent !== window;

// Tools call this when they finish generating a file, so "Send file" appears
// without the user having to download it first.
export async function offerAsendmeFile(source: Blob | string, name: string) {
  if (!embedded() || !source) return;
  try {
    const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
    window.dispatchEvent(new CustomEvent('asendme:file-ready', { detail: new File([blob], name, { type: blob.type }) }));
  }
  catch { /* nothing to offer */ }
}

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
  let lastCopiedAt = 0;
  const noteCopied = (text: string) => {
    if (!text.trim()) return;
    lastCopied = text;
    lastCopiedAt = Date.now();
    refresh();
  };
  const clipboard = navigator.clipboard;
  if (clipboard?.writeText) {
    const original = clipboard.writeText.bind(clipboard);
    clipboard.writeText = (text: string) => {
      noteCopied(String(text ?? ''));
      return original(text);
    };
  }
  document.addEventListener('copy', () => noteCopied(window.getSelection()?.toString() ?? ''));

  // The newest file a tool generated, from a download or an explicit offer.
  const MAX_FILE_BYTES = 50 * 1024 * 1024;
  let lastFile: { file: File; at: number } | null = null;
  const setFile = (file: File) => {
    if (file.size > 0 && file.size <= MAX_FILE_BYTES) {
      lastFile = { file, at: Date.now() };
      refresh();
    }
  };
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function patchedClick(this: HTMLAnchorElement) {
    const { href, download } = this;
    if (download && /^(blob:|data:)/.test(href)) {
      fetch(href).then(r => r.blob()).then(blob => setFile(new File([blob], download, { type: blob.type })))
        .catch(() => { /* download still proceeds */ });
    }
    return originalClick.call(this);
  };
  // Tools call offerAsendmeFile() when they finish generating a file.
  window.addEventListener('asendme:file-ready', (event) => {
    const file = (event as CustomEvent<File>).detail;
    if (file instanceof File) setFile(file);
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'asendme-send';
  button.setAttribute('data-testid', 'tools-send-nearby');
  button.hidden = true;
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
  let selectionAt = 0;
  document.addEventListener('selectionchange', () => {
    const text = window.getSelection()?.toString() ?? '';
    if (text.trim()) {
      selection = text;
      selectionAt = Date.now();
      refresh();
    }
  });
  button.addEventListener('mousedown', e => e.preventDefault());

  const isLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());
  // Decide what the button offers: the newest of file, selected text or copied text.
  function pending(): { kind: 'file' | 'link' | 'text'; file?: File; text?: string } | null {
    const picked = (window.getSelection()?.toString() || '').trim();
    const text = (picked || selection || lastCopied).trim();
    const textAt = picked ? Date.now() : Math.max(selectionAt, lastCopiedAt);
    if (lastFile && (!text || lastFile.at >= textAt)) return { kind: 'file', file: lastFile.file };
    if (text) return { kind: isLink(text) ? 'link' : 'text', text };
    return null;
  }
  function refresh() {
    const next = pending();
    if (!next) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    button.dataset.kind = next.kind;
    if (next.kind === 'file') {
      const name = next.file!.name;
      button.textContent = `Send file: ${name.length > 24 ? `${name.slice(0, 21)}\u2026` : name}`;
    }
    else {
      button.textContent = next.kind === 'link' ? 'Send link' : 'Send text';
    }
  }

  button.addEventListener('click', () => {
    const next = pending();
    if (!next) return;
    if (next.kind === 'file') {
      window.parent.postMessage({ type: 'asendme:send-file', file: next.file }, window.location.origin);
      say(`Choose who receives ${next.file!.name}\u2026`);
      return;
    }
    window.parent.postMessage({ type: 'asendme:send-text', text: next.text!.slice(0, 20000) }, window.location.origin);
    say(next.kind === 'link' ? 'Choose who receives the link\u2026' : 'Choose who receives the text\u2026');
  });

  const mount = () => document.body.append(button, hint);
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}
