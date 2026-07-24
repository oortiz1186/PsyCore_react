import '@/app/patients-crm.css';
import '@/app/availability-settings.css';
import '@/app/toasts.css';
import AppShell from '@/components/app-shell';
import { ToastBridge } from '@/components/ui/toast-bridge';

export default function ProtectedLayout({children}:{children:React.ReactNode}){
  return <AppShell><ToastBridge/>{children}</AppShell>;
}
