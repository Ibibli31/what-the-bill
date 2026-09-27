/** Keeps the corner popups (profile, learn more) from stacking: opening one closes the others. */

const EVENT = "wtb:popup-open";

export function announcePopupOpen(name: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: name }));
}

/** Calls `close` whenever a different popup opens. Returns the unsubscribe function. */
export function onOtherPopupOpen(name: string, close: () => void) {
  const listener = (event: Event) => {
    if ((event as CustomEvent<string>).detail !== name) close();
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
