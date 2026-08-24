/**
 * use:holdDrag — iOS-style press-and-hold on a list card.
 *
 *   tap                        -> passes straight through as a click
 *   hold 420 ms                -> "picked up": haptic + lift, onpickup()
 *   ...then move the finger    -> onmove(dy) while dragging
 *   ...then release            -> ondrop(true)
 *   hold, release without move -> ondrop(false) + onmenu()  (the action sheet)
 *
 * While a card is picked up, touchmove is preventDefault()ed through a
 * non-passive listener so the page can't scroll away under the finger. That
 * works on iOS because pickup only happens after a *stationary* hold, i.e.
 * before Safari has started a scroll gesture of its own.
 */
export function holdDrag(node, opts) {
  let o = opts;

  const HOLD_MS = 420;
  const SLOP = 10; // finger wobble still counted as "holding still"
  const MOVE_MIN = 6; // movement after pickup that counts as a real drag

  let timer = null;
  let picked = false;
  let moved = false;
  let suppressClick = false;
  let sx = 0;
  let sy = 0;
  let pid = null;

  const clearTimer = () => {
    clearTimeout(timer);
    timer = null;
  };

  const down = (e) => {
    if (o?.disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    picked = false;
    moved = false;
    suppressClick = false;
    sx = e.clientX;
    sy = e.clientY;
    pid = e.pointerId;
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      picked = true;
      suppressClick = true; // a hold must never also toggle the timer
      try {
        node.setPointerCapture(pid);
      } catch {}
      if (navigator.vibrate) navigator.vibrate(10);
      o?.onpickup?.();
    }, HOLD_MS);
  };

  const move = (e) => {
    if (pid !== null && e.pointerId !== pid) return;
    const dy = e.clientY - sy;
    if (!picked) {
      // moving before the hold completes = the user is scrolling
      if (Math.hypot(e.clientX - sx, dy) > SLOP) clearTimer();
      return;
    }
    if (Math.abs(dy) > MOVE_MIN) moved = true;
    o?.onmove?.(dy);
  };

  const touchMove = (e) => {
    if (picked) e.preventDefault(); // hold the page still while dragging
  };

  const up = (e) => {
    if (pid !== null && e.pointerId !== pid) return;
    clearTimer();
    try {
      node.releasePointerCapture(pid);
    } catch {}
    pid = null;
    if (!picked) return;
    const wasMoved = moved;
    picked = false;
    moved = false;
    o?.ondrop?.(wasMoved);
    if (!wasMoved) o?.onmenu?.();
  };

  const cancel = () => {
    clearTimer();
    pid = null;
    if (!picked) return;
    picked = false;
    moved = false;
    o?.ondrop?.(false); // put the card back, no menu
  };

  const swallowClick = (e) => {
    if (!suppressClick) return;
    suppressClick = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  };

  const block = (e) => e.preventDefault(); // no iOS callout, no text selection

  node.style.webkitTouchCallout = 'none';
  node.style.userSelect = 'none';
  node.style.webkitUserSelect = 'none';

  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('touchmove', touchMove, { passive: false });
  node.addEventListener('click', swallowClick, true);
  node.addEventListener('contextmenu', block);
  node.addEventListener('selectstart', block);

  return {
    update(next) {
      o = next;
    },
    destroy() {
      clearTimer();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('touchmove', touchMove);
      node.removeEventListener('click', swallowClick, true);
      node.removeEventListener('contextmenu', block);
      node.removeEventListener('selectstart', block);
    }
  };
}
