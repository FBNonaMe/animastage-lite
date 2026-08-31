import { useCallback, useRef } from 'react';

interface SunDialProps {
  azimuth: number;
  elevation: number;
  onChange: (azimuth: number, elevation: number) => void;
}

/** Draggable 2D sun control — mobile-friendly. */
export default function SunDial({ azimuth, elevation, onChange }: SunDialProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.85;
      const dx = clientX - cx;
      const dy = cy - clientY;
      const az = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
      const dist = Math.min(1, Math.hypot(dx, dy) / (rect.width * 0.42));
      const elDeg = 8 + dist * 72;
      onChange(Math.round(az), Math.round(elDeg));
    },
    [onChange]
  );

  const sunX = 50 + Math.sin((azimuth * Math.PI) / 180) * (elevation / 85) * 38;
  const sunY = 82 - (elevation / 85) * 55;

  return (
    <div className="space-y-1">
      <div className="text-[9px] font-bold text-zinc-500 uppercase">Drag the sun</div>
      <div
        ref={ref}
        className="relative h-24 rounded-lg border border-amber-500/25 bg-gradient-to-b from-sky-900/40 to-amber-950/20 touch-none cursor-crosshair"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handlePointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          handlePointer(e.clientX, e.clientY);
        }}
      >
        <div
          className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_12px_#fbbf24] pointer-events-none"
          style={{ left: `${sunX}%`, top: `${sunY}%` }}
        />
        <div className="absolute bottom-1 left-1 text-[8px] text-zinc-500 font-mono">
          {Math.round(azimuth)}° · {Math.round(elevation)}°
        </div>
      </div>
    </div>
  );
}
