'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; kind: ToastKind; message: string };

const MAX_TOASTS = 4;
const AUTO_CLOSE_MS = 4500;

function kindFor(element: Element): ToastKind {
  if (element.classList.contains('success')) return 'success';
  if (element.classList.contains('error')) return 'error';
  return 'info';
}

export function ToastBridge() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const seen = useRef(new WeakMap<Element, string>());

  useEffect(() => {
    function dismiss(id: number) {
      setToasts(current => current.filter(item => item.id !== id));
    }

    function push(kind: ToastKind, message: string) {
      const text = message.trim();
      if (!text) return;
      const id = nextId.current++;
      setToasts(current => [...current.slice(-(MAX_TOASTS - 1)), { id, kind, message: text }]);
      window.setTimeout(() => dismiss(id), AUTO_CLOSE_MS);
    }

    function inspect(root: ParentNode) {
      const elements = root instanceof Element && root.matches('.error,.success,.info')
        ? [root]
        : Array.from(root.querySelectorAll?.('.error,.success,.info') || []);

      for (const element of elements) {
        if (element.closest('.toast-viewport')) continue;
        const message = element.textContent?.trim() || '';
        if (!message || seen.current.get(element) === message) continue;
        seen.current.set(element, message);
        element.classList.add('toast-source-hidden');
        push(kindFor(element), message);
      }
    }

    inspect(document.body);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          if (mutation.target.parentElement) inspect(mutation.target.parentElement);
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) inspect(node);
        }
        if (mutation.target instanceof Element) inspect(mutation.target);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  function dismiss(id: number) {
    setToasts(current => current.filter(item => item.id !== id));
  }

  return <div className="toast-viewport" aria-live="polite" aria-atomic="false">
    {toasts.map(item => <div key={item.id} className={`toast toast-${item.kind}`} role={item.kind === 'error' ? 'alert' : 'status'}>
      <span className="toast-icon" aria-hidden="true">
        {item.kind === 'success' ? <CheckCircle2 size={20} /> : item.kind === 'error' ? <CircleAlert size={20} /> : <Info size={20} />}
      </span>
      <div className="toast-message">{item.message}</div>
      <button type="button" className="toast-close" onClick={() => dismiss(item.id)} aria-label="Cerrar notificación"><X size={17} /></button>
    </div>)}
  </div>;
}
