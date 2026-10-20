import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { constrainImage, fitImage, INITIAL_IMAGE_TRANSFORM, MAX_IMAGE_ZOOM, MIN_IMAGE_ZOOM, type ImageTransform, type Size } from '../../data/imageViewport';

export type ReviewImageStatus = 'loading' | 'ready' | 'error' | 'missing';
interface Props {
  src?: string;
  label: string;
  onStatus?: (status: ReviewImageStatus) => void;
}

/** Mount with a source/document key so image errors and transforms cannot leak into another document. */
export const ReviewImageViewer: React.FC<Props> = ({ src, label, onStatus }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Size>({ width: 0, height: 0 });
  const [image, setImage] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<ImageTransform>(INITIAL_IMAGE_TRANSFORM);
  const [status, setStatus] = useState<ReviewImageStatus>(src ? 'loading' : 'missing');
  const [attempt, setAttempt] = useState(0);
  const [moveImage, setMoveImage] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ center: { x: number; y: number }; distance: number; view: ImageTransform } | null>(null);
  const shown = constrainImage(view, frame, image);
  const latest = useRef(shown); latest.current = shown;
  const ready = status === 'ready';

  useEffect(() => { onStatus?.(status); }, [status, onStatus]);
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const measure = () => setFrame({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('error'), 15000);
    return () => clearTimeout(timer);
  }, [status, attempt]);

  useEffect(() => {
    const element = frameRef.current;
    if (!element || !ready) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); event.stopPropagation();
      setView(current => constrainImage({ ...current, zoom: current.zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15) }, frame, image));
    };
    const release = () => { pointers.current.clear(); gesture.current = null; };
    element.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('blur', release);
    return () => { element.removeEventListener('wheel', wheel); window.removeEventListener('blur', release); release(); };
  }, [ready, frame, image]);

  const captureGesture = () => {
    const points = [...pointers.current.values()];
    if (!points.length) { gesture.current = null; return; }
    const second = points[1] || points[0];
    gesture.current = {
      center: { x: (points[0].x + second.x) / 2, y: (points[0].y + second.y) / 2 },
      distance: points.length > 1 ? Math.hypot(points[0].x - second.x, points[0].y - second.y) : 0,
      view: { ...latest.current },
    };
  };
  const releasePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    captureGesture();
  };
  const setTouchMovement = (enabled: boolean) => {
    const element = frameRef.current;
    for (const id of pointers.current.keys()) {
      if (element?.hasPointerCapture(id)) element.releasePointerCapture(id);
    }
    pointers.current.clear(); gesture.current = null;
    setMoveImage(enabled);
  };
  const resetView = () => { setView(INITIAL_IMAGE_TRANSFORM); setTouchMovement(false); };
  const change = (changes: Partial<ImageTransform>) => setView(current => constrainImage({ ...current, ...changes }, frame, image));
  const fitted = fitImage(frame, image);
  return (
    <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4" aria-label={`${label} viewer`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">{label}</h3>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!ready || shown.zoom <= MIN_IMAGE_ZOOM} onClick={() => change({ zoom: shown.zoom / 1.25 })} aria-label={`Zoom out ${label}`} className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"><ZoomOut className="h-4 w-4" /></button>
          <button type="button" disabled={!ready} onClick={resetView} aria-label={`Reset ${label} view`} title="Reset zoom, rotation and position" className="min-w-14 rounded-lg px-2 py-2 text-xs tabular-nums text-zinc-600 hover:bg-zinc-100 disabled:opacity-30">{Math.round(shown.zoom * 100)}%</button>
          <button type="button" disabled={!ready || shown.zoom >= MAX_IMAGE_ZOOM} onClick={() => change({ zoom: shown.zoom * 1.25 })} aria-label={`Zoom in ${label}`} className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"><ZoomIn className="h-4 w-4" /></button>
          <button type="button" disabled={!ready} onClick={() => change({ rotation: shown.rotation + 90 })} aria-label={`Rotate ${label}`} className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"><RotateCw className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!ready} aria-label={`Move ${label}`} aria-pressed={moveImage}
          onClick={() => setTouchMovement(!moveImage)}
          className={`min-h-10 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-30 ${moveImage ? 'bg-orange-100 text-orange-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}>
          {moveImage ? 'Scroll page' : 'Move image'}
        </button>
        <span className="text-[11px] text-zinc-500">{moveImage ? 'Drag or pinch the image. Tap Scroll page when done.' : 'Swipe over the image to scroll down.'}</span>
      </div>
      <div
        ref={frameRef}
        tabIndex={ready ? 0 : -1}
        role="group"
        aria-label={`${label}: ${moveImage ? 'drag or pinch to move and zoom' : 'swipe to scroll; enable Move image for touch dragging and pinch zoom'}; use zoom controls or arrow keys to pan`}
        className={`relative h-[clamp(220px,45vh,620px)] overflow-hidden rounded-xl bg-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${ready ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ touchAction: ready && moveImage ? 'none' : 'pan-y pinch-zoom' }}
        onDoubleClick={resetView}
        onPointerDown={event => {
          if (!ready || (event.pointerType === 'mouse' && event.button !== 0) || pointers.current.size >= 2) return;
          if (event.pointerType !== 'mouse' && !moveImage) return;
          event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); captureGesture();
        }}
        onPointerMove={event => {
          if (!pointers.current.has(event.pointerId) || !gesture.current) return;
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          const points = [...pointers.current.values()], second = points[1] || points[0], start = gesture.current;
          const distance = Math.hypot(points[0].x - second.x, points[0].y - second.y);
          setView(constrainImage({ ...start.view,
            zoom: start.distance > 0 && points.length > 1 ? start.view.zoom * distance / start.distance : start.view.zoom,
            x: start.view.x + (points[0].x + second.x) / 2 - start.center.x,
            y: start.view.y + (points[0].y + second.y) / 2 - start.center.y,
          }, frame, image));
        }}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onLostPointerCapture={event => { pointers.current.delete(event.pointerId); captureGesture(); }}
        onKeyDown={event => {
          if (!ready) return;
          const steps: Record<string, Partial<ImageTransform>> = {
            ArrowLeft: { x: shown.x + 40 }, ArrowRight: { x: shown.x - 40 },
            ArrowUp: { y: shown.y + 40 }, ArrowDown: { y: shown.y - 40 },
            '+': { zoom: shown.zoom * 1.25 }, '=': { zoom: shown.zoom * 1.25 }, '-': { zoom: shown.zoom / 1.25 },
          };
          if (event.key === '0' || event.key === 'Home') { event.preventDefault(); resetView(); }
          else if (steps[event.key]) { event.preventDefault(); change(steps[event.key]); }
        }}
      >
        {src && status !== 'error' && <img
          key={attempt} src={src} alt={label} draggable={false}
          onLoad={event => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (!naturalWidth || !naturalHeight) { setStatus('error'); return; }
            setImage({ width: naturalWidth, height: naturalHeight }); setStatus('ready');
          }}
          onError={() => setStatus('error')}
          style={{ width: fitted.width, height: fitted.height,
            transform: `translate(-50%, -50%) translate(${shown.x}px, ${shown.y}px) rotate(${shown.rotation}deg) scale(${shown.zoom})`,
            visibility: ready ? 'visible' : 'hidden',
          }}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
        />}
        {!ready && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-zinc-500" role="status">
          {status === 'loading' ? <><Loader2 className="h-6 w-6 animate-spin" /><span>Loading image…</span></> : <><AlertCircle className="h-6 w-6 text-zinc-400" /><span>{status === 'error' ? 'Image could not load.' : 'No image submitted.'}</span></>}
          {status === 'error' && <button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1); }} className="rounded-full bg-white px-4 py-2 font-semibold text-zinc-700">Try again</button>}
        </div>}
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">Use the controls or mouse wheel to zoom · Double-click to reset</p>
    </section>
  );
};
