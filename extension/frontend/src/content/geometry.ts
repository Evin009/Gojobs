// Where each shape sits. Both are the same element, so these are just two sets
// of numbers Framer animates between.
//
// Expressed as x/y/width/height from the top-left rather than as top/right
// offsets: animating `right` on one shape and `left` on the other leaves
// Framer nothing continuous to tween, which is what makes a morph stall.

export const NOTCH = { w: 116, h: 30 };
export const NOTCH_OPEN = { w: 400, h: 64 };
export const PANEL = { w: 404, margin: 14 };

// The notch hangs off the top edge of the window, so its top corners stay
// square — a rounded top would float it away from the edge it belongs to.
export function notchBox(open: boolean) {
  const { w, h } = open ? NOTCH_OPEN : NOTCH;

  return {
    x: window.innerWidth / 2 - w / 2,
    y: 0,
    width: w,
    height: h,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: open ? 22 : 16,
    borderBottomRightRadius: open ? 22 : 16,
  };
}

export function panelBox() {
  return {
    x: window.innerWidth - PANEL.w - PANEL.margin,
    y: PANEL.margin,
    width: PANEL.w,
    height: Math.min(window.innerHeight - PANEL.margin * 2, 580),
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  };
}
