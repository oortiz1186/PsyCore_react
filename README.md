# PsyCore React

Reconstrucción de PsyCore con Next.js, React, TypeScript, Supabase y Nodemailer.

## Incluye

- Inicio de sesión con Supabase Auth
- Sesión persistente
- Cambio obligatorio de contraseña temporal
- Dashboard
- Pacientes
- Agenda
- Expedientes clínicos SOAP
- Administración de usuarios y roles
- Creación segura de usuarios con Supabase Admin
- Envío SMTP de acceso temporal
- Activación y desactivación de usuarios
- Pantalla de prueba SMTP

## Instalación

```bash
npm install
cp .env.example .env.local
npm run dev
```

Completa `.env.local` con las claves de Supabase y SMTP.

## Base de datos

Ejecuta en Supabase SQL Editor, en este orden:

1. `supabase/migrations/20260722_psycore_nextjs.sql`
2. `supabase/migrations/20260722_psycore_modules_compatibility.sql`

Las tablas y datos existentes se reutilizan.

## Seguridad

`SUPABASE_SERVICE_ROLE_KEY` y las credenciales SMTP solo se usan en Route Handlers de Next.js. Nunca deben llevar el prefijo `NEXT_PUBLIC_`.
