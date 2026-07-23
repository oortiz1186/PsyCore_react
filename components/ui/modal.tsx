'use client';

import { ReactNode, useEffect } from 'react';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
};

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  closeDisabled = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closeDisabled, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description ? <p className="muted">{description}</p> : null}
          </div>

          <button
            className="modal-close"
            type="button"
            aria-label="Cerrar ventana"
            onClick={onClose}
            disabled={closeDisabled}
          >
            ×
          </button>
        </header>

        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
