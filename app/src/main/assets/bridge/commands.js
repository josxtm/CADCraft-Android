/* Android IME belongs to a real DOM input, never synthetic keyboard events. */
(() => {
  'use strict';
  if (window.__cadcraftCommandsInstalled) return;
  window.__cadcraftCommandsInstalled = true;
  const form = document.createElement('form');
  form.id = 'cadcraft-command-input';
  form.style.cssText = 'position:fixed;z-index:2147483646;display:none;margin:0';
  const input = document.createElement('input');
  input.type = 'text';
  input.setAttribute('aria-label', 'Comando CADCraft');
  input.placeholder = 'Escribir comando…';
  input.autocomplete = 'off';
  input.setAttribute('autocorrect', 'off');
  input.spellcheck = false;
  input.enterKeyHint = 'send';
  input.style.cssText = 'box-sizing:border-box;width:100%;height:100%;min-width:0;border:0;background:#18212c;color:white;font:16px sans-serif;padding:0 4px;border-radius:3px';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Deseleccionar';
  clear.style.cssText = 'position:fixed;left:12px;top:12px;z-index:2147483646;min-height:44px;padding:8px;font:16px sans-serif';
  clear.disabled = true;
  form.appendChild(input);
  document.body.appendChild(form);
  document.body.appendChild(clear);
  let composing = false;
  let editing = false;
  let ready = false;
  const send = (action, text) => {
    if (!ready || window.__cadcraftCommandRequest != null) return false;
    window.__cadcraftCommandRequest = JSON.stringify({action, text});
    return true;
  };
  // eframe listens on the document too. IME/physical keystrokes in this input
  // must not be processed a second time by the canvas command handler.
  for (const event of ['keydown', 'keyup', 'keypress', 'input', 'beforeinput', 'compositionstart', 'compositionupdate', 'compositionend']) {
    input.addEventListener(event, e => e.stopPropagation());
  }
  input.addEventListener('compositionstart', () => { composing = true; });
  const syncDraft = () => { if (!composing) window.__cadcraftCommandDraft = input.value; };
  input.addEventListener('input', syncDraft);
  input.addEventListener('compositionend', () => { composing = false; syncDraft(); });
  input.addEventListener('focus', () => { editing = true; });
  input.addEventListener('blur', () => { editing = false; composing = false; });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (composing || e.isComposing || e.keyCode === 229)) e.preventDefault();
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (composing) return;
    if (send('submit', input.value)) {
      window.__cadcraftCommandDraft = null;
      input.value = '';
    }
  });
  clear.addEventListener('click', () => { send('deselect'); });
  function update() {
    let state;
    try { state = JSON.parse(window.__cadcraftCommandState || 'null'); } catch (_) { state = null; }
    const canvas = document.getElementById('cadcraft_canvas');
    ready = !!(state && canvas);
    clear.disabled = !ready || window.__cadcraftCommandRequest != null;
    if (ready && state.rect && state.rect[2] > 0 && state.width > 0 && state.height > 0) {
      const box = canvas.getBoundingClientRect();
      const [x, y, w, h] = state.rect;
      form.style.display = 'block';
      form.style.left = `${box.left + x * box.width / state.width}px`;
      form.style.top = `${box.top + y * box.height / state.height}px`;
      form.style.width = `${w * box.width / state.width}px`;
      form.style.height = `${Math.max(24, h * box.height / state.height)}px`;
      // Never overwrite composition or a draft when Android closes the keyboard.
      if (!editing && !input.value && window.__cadcraftCommandRequest == null) input.value = state.buffer || '';
    } else {
      form.style.display = 'none';
    }
    window.requestAnimationFrame(update);
  }
  // Wake eframe if WASM became idle before this asset finished loading.
  window.dispatchEvent(new Event('resize'));
  update();
})();
