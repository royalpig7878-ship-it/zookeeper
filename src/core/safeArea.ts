export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The parts of the screen a phone covers with a notch, rounded corners or a home bar. The page asks
 * the browser (CSS env()) and falls back to no insets anywhere that does not know about them.
 */
export function readSafeArea(): Insets {
  const none = { top: 0, right: 0, bottom: 0, left: 0 };
  try {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
      + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const px = (v: string) => (Number.isFinite(parseFloat(v)) ? Math.max(0, Math.min(80, parseFloat(v))) : 0);
    const out = { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
    probe.remove();
    return out;
  } catch {
    return none;
  }
}
