import '@/app/patients-crm.css';
import AppShell from '@/components/app-shell';

export default function ProtectedLayout({children}:{children:React.ReactNode}){
  return <AppShell>{children}</AppShell>;
}
