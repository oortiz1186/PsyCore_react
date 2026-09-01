# PsyCore Platform Roadmap

## Objetivo
Evolucionar PsyCore de expediente/agenda a plataforma clínica y administrativa modular para psicología, preparada para consultorios y posteriormente SaaS multi-organización.

## Principios
- El profesional conserva la decisión clínica final.
- La inteligencia clínica es explicable y de apoyo, no diagnóstico autónomo.
- Datos clínicos con mínimo privilegio, RLS, auditoría y trazabilidad.
- Entregas pequeñas con build verde y migraciones idempotentes.

## Fase 1 — Núcleo clínico
- [x] Pacientes
- [x] Notas SOAP
- [x] Evaluaciones base
- [x] Objetivos terapéuticos base
- [x] Clinical Intelligence modular
- [x] Historia clínica avanzada: esquema
- [x] Plan terapéutico: esquema
- [x] Objetivos por plan: esquema
- [ ] UI historia clínica
- [ ] UI plan terapéutico y objetivos
- [ ] Línea de tiempo clínica unificada
- [ ] Alta/cierre terapéutico
- [ ] Gráficas longitudinales PHQ-9/GAD-7

## Fase 2 — Experiencia del paciente
- [x] Archivos del paciente base
- [x] Consentimientos: esquema
- [x] Tareas terapéuticas: esquema
- [x] Invitaciones portal: esquema
- [ ] Portal autenticado del paciente
- [ ] Firma de consentimiento
- [ ] Cuestionarios desde portal
- [ ] Entrega y respuesta de tareas
- [ ] Documentos PDF clínicos

## Fase 3 — Agenda inteligente y comunicación
- [x] Disponibilidad y bloqueos
- [x] Conflictos de agenda
- [x] Consultorios
- [x] Recordatorios: esquema
- [ ] Citas recurrentes
- [ ] Lista de espera
- [ ] Confirmar/cancelar desde enlace
- [ ] Recordatorio por correo
- [ ] Adaptador WhatsApp
- [ ] Videoconsulta/enlace externo

## Fase 4 — Administración y finanzas
- [x] Configuración de práctica
- [x] Usuarios y roles
- [x] Conceptos/cargos: esquema
- [x] Pagos: esquema
- [ ] Caja y cuentas por cobrar
- [ ] Tarifas por profesional
- [ ] Paquetes de sesiones
- [ ] Dashboard financiero
- [ ] Recibos PDF
- [ ] CFDI mediante proveedor compatible

## Fase 5 — Seguridad y gobierno
- [x] RLS base
- [x] Auditoría: esquema
- [ ] RLS por profesional/organización en todos los módulos
- [ ] Registro automático de accesos a expediente
- [ ] MFA para perfiles clínicos/administrativos
- [ ] Sesiones y cierre remoto
- [ ] Retención y exportación controlada de datos
- [ ] Backups y procedimiento de restauración
- [ ] Rate limiting en endpoints sensibles

## Fase 6 — Clinical Intelligence 2.0
- [x] Motor de reglas modular
- [ ] Tendencias longitudinales persistentes
- [ ] Resumen de cambios desde sesión anterior
- [ ] Indicadores de adherencia
- [ ] Alertas explicables y auditables
- [ ] Panel de seguimiento clínico
- [ ] Tests unitarios de reglas

## Fase 7 — Asistente IA
- [ ] Proveedor desacoplado de IA
- [ ] Resumen de expediente bajo demanda
- [ ] Borrador SOAP desde notas/dictado
- [ ] Comparación entre sesiones
- [ ] Borrador de reportes
- [ ] Registro de prompts/resultados clínicos
- [ ] Revisión humana obligatoria antes de persistir contenido generado

## Fase 8 — SaaS multi-organización
- [ ] Organizations
- [ ] Memberships y roles por organización
- [ ] Sucursales
- [ ] Aislamiento RLS por organization_id
- [ ] Planes/suscripciones
- [ ] Administración global
- [ ] Branding por organización

## Calidad transversal
- [x] Build CI
- [x] Generador de tipos Supabase preparado
- [ ] database.types.ts real
- [ ] Eliminar createClient<any>
- [ ] npm lockfile y npm ci
- [ ] ESLint limpio
- [ ] Tests unitarios
- [ ] Tests de integración RLS
- [ ] Playwright para flujos críticos
- [ ] Validación automática de migraciones
