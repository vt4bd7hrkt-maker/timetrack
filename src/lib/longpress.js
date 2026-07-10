/**
 * use:longpress={callback} — invokes callback after 480 ms of steady contact.
 * Suppresses the subsequent click so a long press never also toggles the timer.
 */
export function longpress(node, callback) {
  let timer = null;
  let fired = false;
  let sx = 0;
  let sy = 0;

  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    fired = false;
    sx = e.clientX;
    sy = e.clientY;
    timer = setTimeout(() => {
      fired = true;
      if (navigator.vibrate) navigator.vibrate(10);
      callback?.();
    }, 480);
  };

  const move = (e) => {
    if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) cancel();
  };

  const cancel = () => {
    clearTimeout(timer);
    timer = null;
  };

  const click = (e) => {
    if (fired) {
      e.stopImmediatePropagation();
      e.preventDefault();
      fired = false;
    }
  };

  const ctx = (e) => e.preventDefault(); // no iOS callout / desktop context menu

  node.style.webkitTouchCallout = 'none';
  node.style.userSelect = 'none';
  node.style.webkitUserSelect = 'none';

  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('click', click, true);
  node.addEventListener('contextmenu', ctx);

  return {
    update(newCallback) {
      callback = newCallback;
    },
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', cancel);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('click', click, true);
      node.removeEventListener('contextmenu', ctx);
    }
  };
}
