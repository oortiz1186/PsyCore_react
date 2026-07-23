'use client';

import { Modal } from '@/components/ui/modal';

type Props = {
  open: boolean;
  userName: string;
  userEmail: string;
  action: 'reset-access' | 'resend-access';
  saving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function UserAccessModal({
  open,
  userName,
  userEmail,
  action,
  saving,
  onClose,
  onConfirm,
}: Props) {
  const reset = action === 'reset-access';

  return (
    <Modal
      open={open}
      title={reset ? 'Restablecer contraseña' : 'Reenviar acceso'}
      description={`${userName || 'Usuario'} · ${userEmail}`}
      onClose={onClose}
      closeDisabled={saving}
    >
      <div className="form">
        <div className="notice-card">
          Se generará una nueva contraseña temporal, se activará la cuenta y se enviará por correo.
          La contraseña actual dejará de funcionar y el usuario deberá cambiarla al iniciar sesión.
        </div>
        <footer className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void onConfirm()} disabled={saving}>
            {saving ? 'Enviando...' : reset ? 'Restablecer y enviar' : 'Generar y reenviar'}
          </button>
        </footer>
      </div>
    </Modal>
  );
}
