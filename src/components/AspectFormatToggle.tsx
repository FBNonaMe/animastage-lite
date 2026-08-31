import { Smartphone, Monitor, Square, RectangleHorizontal } from 'lucide-react';
import type { ViewportFormat } from '../types';
import { VIEWPORT_FORMAT_OPTIONS } from '../utils/viewportFormat';

interface AspectFormatToggleProps {
  format: ViewportFormat;
  onChange: (format: ViewportFormat) => void;
  className?: string;
}

function formatIcon(id: ViewportFormat) {
  if (id === '9:16' || id === '4:5') return Smartphone;
  if (id === '1:1') return Square;
  if (id === '21:9') return RectangleHorizontal;
  return Monitor;
}

export default function AspectFormatToggle({
  format,
  onChange,
  className = '',
}: AspectFormatToggleProps) {
  return (
    <div
      className={`flex items-center flex-wrap bg-[#121418]/85 border border-zinc-800 rounded-md overflow-hidden shadow-md backdrop-blur-sm ${className}`}
      role="group"
      aria-label="Viewport aspect ratio"
    >
      {VIEWPORT_FORMAT_OPTIONS.map((opt) => {
        const active = format === opt.id;
        const Icon = formatIcon(opt.id);
        const portraitish = opt.id === '9:16' || opt.id === '4:5';
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`px-2 py-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide transition-colors cursor-pointer border-l border-zinc-800 first:border-l-0 ${
              active
                ? portraitish
                  ? 'bg-[#ff3385]/20 text-[#ff6ba8]'
                  : 'bg-[#39c5bb]/20 text-[#39c5bb]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title={`Viewport ${opt.label}`}
          >
            <Icon className="w-3 h-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
