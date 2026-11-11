import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Wider sheets for pickers and the activity view. */
  size?: 'md' | 'lg';
}

export function Modal({ open, title, description, onClose, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          role="presentation"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.99 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={cn(
              'w-full rounded-panel border border-border-strong bg-surface shadow-xl',
              size === 'lg' ? 'max-w-2xl' : 'max-w-md',
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-content">{title}</h2>
                {description ? <p className="mt-1 text-xs text-content-muted">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="text-content-muted transition-colors hover:text-content"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="px-5 py-4">{children}</div>

            {footer ? (
              <div className="flex justify-end gap-2 border-t border-border-subtle px-5 py-3">{footer}</div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
