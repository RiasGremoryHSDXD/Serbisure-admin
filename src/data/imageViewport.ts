export interface Size { width: number; height: number }
export interface ImageTransform { zoom: number; rotation: number; x: number; y: number }
export const INITIAL_IMAGE_TRANSFORM: ImageTransform = { zoom: 1, rotation: 0, x: 0, y: 0 };
export const MIN_IMAGE_ZOOM = 0.5;
export const MAX_IMAGE_ZOOM = 5;

export function fitImage(frame: Size, image: Size): Size {
  if (![frame.width, frame.height, image.width, image.height].every(value => Number.isFinite(value) && value > 0)) return { width: 0, height: 0 };
  const scale = Math.min(frame.width / image.width, frame.height / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

/** Keep enough of the image in the frame so dragging can never lose it. */
export function constrainImage(view: ImageTransform, frame: Size, image: Size): ImageTransform {
  const zoom = Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, Number.isFinite(view.zoom) ? view.zoom : 1));
  const rotation = ((Math.round((Number.isFinite(view.rotation) ? view.rotation : 0) / 90) * 90) % 360 + 360) % 360;
  const fitted = fitImage(frame, image);
  const sideways = rotation % 180 !== 0;
  const maxX = Math.max(0, ((sideways ? fitted.height : fitted.width) * zoom - frame.width) / 2);
  const maxY = Math.max(0, ((sideways ? fitted.width : fitted.height) * zoom - frame.height) / 2);
  return { zoom, rotation,
    x: Math.max(-maxX, Math.min(maxX, Number.isFinite(view.x) ? view.x : 0)) || 0,
    y: Math.max(-maxY, Math.min(maxY, Number.isFinite(view.y) ? view.y : 0)) || 0,
  };
}
