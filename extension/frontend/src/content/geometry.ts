// Where each shape sits. Both are the same element, so these are just two sets
// of numbers Framer animates between.
//
// Everything is expressed as x/y/width/height from the top-left corner rather
// than as top/right offsets: animating `right` on one shape and `left` on the
// other means Framer has nothing continuous to tween, which is what makes a
// morph stall. Transforms are also GPU-composited, so this stays smooth over a
// busy page.

export const NOTCH = { w: 104, h: 30 };
export const NOTCH_OPEN = { w: 400, h: 64 };
export const PANEL = { w: 400, margin: 14 };

export function notchBox(open: boolean) {
  const { w, h } = open ? NOTCH_OPEN : NOTCH;

  return {
    x: window.innerWidth / 2 - w / 2,
    y: 0,
    width: w,
    height: h,
    borderRadius: 20,
  };
}

export function panelBox() {
  return {
    x: window.innerWidth - PANEL.w - PANEL.margin,
    y: PANEL.margin,
    width: PANEL.w,
    height: Math.min(window.innerHeight - PANEL.margin * 2, 560),
    borderRadius: 16,
  };
}
