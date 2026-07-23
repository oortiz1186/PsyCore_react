# PsyCore Design System

## Objetivo

Mantener una identidad visual clínica, cálida y profesional en todos los módulos. Los componentes nuevos deben reutilizar los tokens y clases `pc-*` antes de agregar estilos aislados.

## Identidad

- Primario: lavanda, para acciones principales, navegación y énfasis.
- Acento: verde salvia, para estados clínicos positivos y elementos de apoyo.
- Neutros: grises cálidos, para texto, fondos y bordes.
- Éxito, advertencia, peligro e información tienen escalas independientes.

## Tipografía

- `pc-display`: portadas y mensajes principales.
- `pc-heading-xl`: título principal de módulo.
- `pc-heading-lg`: encabezado de sección.
- `pc-heading-md`: título de tarjeta.
- `pc-body`: texto descriptivo.
- `pc-caption`: datos secundarios.
- `pc-label`: etiquetas de formulario.

## Layout

- `pc-page`: limita el ancho de lectura.
- `pc-stack`: contenido vertical.
- `pc-cluster`: acciones horizontales con salto de línea.
- `pc-split`: encabezados con contenido a ambos lados.
- `pc-grid`: tarjetas responsivas.

## Superficies

- `pc-surface`: tarjeta base.
- `pc-surface-raised`: tarjeta destacada.
- `pc-surface-interactive`: tarjeta con respuesta al pasar el cursor.

## Botones

Usar `components/ui/button.tsx`.

Variantes:

- `primary`: acción principal.
- `secondary`: acción alternativa.
- `ghost`: acción de baja prioridad.
- `danger`: acción destructiva.

Tamaños:

- `md`: normal.
- `sm`: tablas y acciones compactas.
- `icon`: botón cuadrado de icono.

## Formularios

- `pc-field`: agrupador de campo.
- `pc-label`: etiqueta.
- `pc-input`, `pc-select`, `pc-textarea`: controles.
- `pc-help`: ayuda.
- `pc-field-error`: validación.

## Estados

Badges:

- `pc-badge-neutral`
- `pc-badge-success`
- `pc-badge-warning`
- `pc-badge-danger`
- `pc-badge-info`

Alertas:

- `pc-alert-success`
- `pc-alert-warning`
- `pc-alert-danger`
- `pc-alert-info`

## Reglas

1. No agregar colores hexadecimales nuevos dentro de páginas salvo que se incorporen primero como token.
2. No crear un nuevo estilo de botón si una variante existente resuelve el caso.
3. Mantener un solo botón primario por bloque visual.
4. Formularios y acciones destructivas deben mostrar estados claros de carga y error.
5. La interfaz debe funcionar con teclado y conservar `focus-visible`.
6. Todos los módulos deben responder correctamente en móvil.
