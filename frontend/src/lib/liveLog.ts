// Tiny event bus for the landing page's live background terminal.
// Anything on the page can print a line; BootSequence renders them.
export type LiveKind = 'cmd' | 'out' | 'ok' | 'dim';

export function liveLog(kind: LiveKind, text: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('livelog', { detail: { kind, text } }));
}
