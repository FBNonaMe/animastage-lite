import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../components/UI/cn';

export interface MobileDropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
}

export interface MobileDropdownMenuProps {
  label: string;
  icon?: ReactNode;
  items: MobileDropdownItem[];
  onSelect: (id: string) => void;
  className?: string;
  /** Align menu under trigger */
  align?: 'start' | 'center' | 'end';
  /** Compact trigger (icon + chevron only on tiny screens via CSS) */
  compact?: boolean;
}

/** Phone-friendly dropdown — tap trigger, pick item, auto-close. */
export default function MobileDropdownMenu({
  label,
  icon,
  items,
  onSelect,
  className,
  align = 'center',
  compact = false,
}: MobileDropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn('am-dropdown', open && 'am-dropdown--open', className)}
    >
      <button
        type="button"
        className={cn('am-dropdown__trigger', compact && 'am-dropdown__trigger--compact')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {icon ? <span className="am-dropdown__icon">{icon}</span> : null}
        <span className="am-dropdown__label">{label}</span>
        <ChevronDown
          className={cn('am-dropdown__chevron w-4 h-4', open && 'am-dropdown__chevron--up')}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          className={cn(
            'am-dropdown__menu',
            align === 'start' && 'am-dropdown__menu--start',
            align === 'end' && 'am-dropdown__menu--end'
          )}
        >
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cn(
                  'am-dropdown__item',
                  item.active && 'am-dropdown__item--active'
                )}
                onClick={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
              >
                {item.icon ? (
                  <span className="am-dropdown__item-icon">{item.icon}</span>
                ) : null}
                <span className="am-dropdown__item-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
