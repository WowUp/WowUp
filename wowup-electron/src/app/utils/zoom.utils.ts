// See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values
const ZOOM_IN_CODE = "Equal";
const ZOOM_OUT_CODE = "Minus";
const ZOOM_RESET_CODE = "Digit0";

export const ZOOM_SCALE = [0.5, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0];

export enum ZoomDirection {
  ZoomIn,
  ZoomOut,
  ZoomReset,
  ZoomUnknown,
}

export function isZoomInShortcut(event: KeyboardEvent) {
  return event.ctrlKey && event.code === ZOOM_IN_CODE;
}

export function isZoomOutShortcut(event: KeyboardEvent) {
  return event.ctrlKey && event.code === ZOOM_OUT_CODE;
}

export function isZoomResetShortcut(event: KeyboardEvent) {
  return event.ctrlKey && event.code === ZOOM_RESET_CODE;
}

export function getZoomDirection(event: KeyboardEvent): ZoomDirection {
  if (isZoomInShortcut(event)) {
    return ZoomDirection.ZoomIn;
  } else if (isZoomOutShortcut(event)) {
    return ZoomDirection.ZoomOut;
  } else if (isZoomResetShortcut(event)) {
    return ZoomDirection.ZoomReset;
  }

  return ZoomDirection.ZoomUnknown;
}
