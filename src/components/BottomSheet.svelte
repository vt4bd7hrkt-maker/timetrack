<script>
  /**
   * Native-feeling bottom sheet.
   *  - Drag down on the grabber/title, or on content scrolled to the top,
   *    to dismiss (distance or flick velocity), with rubber-banding upward.
   *  - Backdrop tap and Escape close it. Inner content keeps scrolling.
   *  - Enter/exit run on a springy CSS transition; drag-release springs back.
   */
  let { open = false, title = '', onclose, children } = $props();

  let mounted = $state(false); // element in the DOM
  let shown = $state(false); // CSS "in" state
  let dragging = $state(false);
  let sheetEl = $state(null);
  let scrollEl = $state(null);

  let dragY = 0;
  let startY = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let pulling = false; // an active content pull-down gesture

  /* Deterministic open/close state machine: timers, not transition events,
     so a missed frame or interrupted transition can never leave a stuck,
     invisible sheet blocking the page. */
  let stateTimer = null;
  $effect(() => {
    clearTimeout(stateTimer);
    if (open) {
      mounted = true;
      stateTimer = setTimeout(() => {
        shown = true;
        sheetEl?.focus({ preventScroll: true });
      }, 30); // one paint with the sheet off-screen, so the enter transition runs
    } else if (mounted) {
      shown = false;
      stateTimer = setTimeout(() => {
        mounted = false;
        dragging = false;
        setSheetY(0);
      }, 460); // just past the 0.42s transform transition
    }
    return () => clearTimeout(stateTimer);
  });

  function setSheetY(y) {
    dragY = y;
    if (sheetEl) sheetEl.style.transform = y > 0 ? `translateY(${y}px)` : y < 0 ? `translateY(${y}px)` : '';
  }

  function beginDrag(y) {
    dragging = true;
    startY = y;
    lastY = y;
    lastT = performance.now();
    velocity = 0;
  }

  function updateDrag(y) {
    const now = performance.now();
    if (now > lastT) velocity = (y - lastY) / (now - lastT);
    lastY = y;
    lastT = now;
    const dy = y - startY;
    setSheetY(dy > 0 ? dy : dy / 4); // rubber-band when pulled up
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    const h = sheetEl?.offsetHeight || 320;
    const shouldClose = dragY > h * 0.4 || (velocity > 0.55 && dragY > 24);
    setSheetY(0); // transition (re-enabled by dragging=false) animates from the dragged offset
    if (shouldClose) onclose?.();
  }

  /* --- grabber / header: pointer-driven drag (touch-action: none) --- */
  function headDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    beginDrag(e.clientY);
  }
  const headMove = (e) => dragging && updateDrag(e.clientY);

  /* --- content: pull-down only when its scroller sits at the very top --- */
  function contentTouchStart(e) {
    pulling = false;
    beginDrag(e.touches[0].clientY);
    dragging = false; // becomes a real drag only once we detect a top pull
  }
  function contentTouchMove(e) {
    const y = e.touches[0].clientY;
    if (!dragging) {
      const dy = y - startY;
      if (dy > 4 && (scrollEl?.scrollTop ?? 0) <= 0) {
        dragging = true;
        pulling = true;
      } else if (dy < -4 || (scrollEl?.scrollTop ?? 0) > 0) {
        return; // normal inner scroll
      } else {
        return;
      }
    }
    if (pulling) {
      e.preventDefault(); // stop the scroller from fighting the sheet
      updateDrag(y);
    }
  }
  function contentTouchEnd() {
    if (pulling) endDrag();
    pulling = false;
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      onclose?.();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if mounted}
  <div
    class="backdrop"
    class:shown
    onclick={() => onclose?.()}
    ontouchmove={(e) => e.preventDefault()}
    role="presentation"
  ></div>
  <div
    class="sheet"
    class:shown
    class:dragging
    bind:this={sheetEl}
    role="dialog"
    aria-modal="true"
    aria-label={title || undefined}
    tabindex="-1"
  >
    <div
      class="head"
      onpointerdown={headDown}
      onpointermove={headMove}
      onpointerup={endDrag}
      onpointercancel={endDrag}
    >
      <div class="grabber"></div>
      {#if title}<h3>{title}</h3>{/if}
    </div>
    <div
      class="content"
      bind:this={scrollEl}
      ontouchstart={contentTouchStart}
      ontouchmove={contentTouchMove}
      ontouchend={contentTouchEnd}
      ontouchcancel={contentTouchEnd}
    >
      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 12, 14, 0.44);
    z-index: 90;
    opacity: 0;
    transition: opacity 0.24s ease;
  }
  .backdrop.shown { opacity: 1; }
  /* while animating out, never block taps on the page underneath */
  .backdrop:not(.shown) { pointer-events: none; }

  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 91;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-radius: 22px 22px 0 0;
    box-shadow: var(--shadow-lg);
    max-width: 640px;
    margin: 0 auto;
    max-height: 86vh;
    max-height: 86dvh;
    outline: none;
    transform: translateY(112%);
    transition: transform 0.42s cubic-bezier(0.22, 1.18, 0.34, 1);
    will-change: transform;
  }
  .sheet.shown { transform: translateY(0); }
  .sheet.dragging { transition: none; }

  .head {
    flex-shrink: 0;
    padding: 10px 20px 0;
    touch-action: none;
    cursor: grab;
  }
  .head:active { cursor: grabbing; }
  .grabber {
    width: 38px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    margin: 4px auto 14px;
  }
  h3 { font-size: 18px; margin-bottom: 14px; }

  .content {
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: 0 20px calc(20px + var(--safe-bottom));
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet, .backdrop { transition-duration: 0.01s; }
  }
</style>
