# Frontend — Guía de estructura

Stack: **Next.js (App Router) + React + TypeScript**. Editor de planos 2D con detalles 3D, export a PDF.

## Librerías definitivas

- **konva + react-konva** — canvas 2D, corazón del editor. Colocar/mover/rotar símbolos sobre la planta.
- **zustand** — estado del editor (herramienta activa, selección, zoom). Liviano, nada de Redux.
- **@react-three/fiber + @react-three/drei** — vista 3D (extrusión de paredes, detalles). Solo donde haga falta 3D.
- **react-zoom-pan-pinch** — zoom y pan del canvas.
- **jspdf + svg2pdf.js** — export a PDF vectorial (no rasterizado).
- **lucide-react** — íconos de la UI (botones, menús). NO para símbolos técnicos.
- **tailwindcss** — estilos.
- **zod** — validación de datos que entran/salen de la API.
- **@clerk/nextjs** — autenticación y gestión de usuarios (OAuth).

> Los símbolos eléctricos/sanitarios (IRAM/IEC) NO vienen en ninguna librería. Son SVGs propios en `components/symbols/`.

## Estructura de carpetas

```
src/
├── app/                    # Rutas (App Router). Solo páginas y layouts.
│   ├── layout.tsx
│   ├── page.tsx
│   └── projects/[id]/page.tsx
│
├── components/             # Componentes de UI reutilizables
│   ├── ui/                 # Botones, inputs, modales genéricos
│   ├── editor/             # Canvas, toolbar, panel de propiedades
│   ├── symbols/            # SVGs de símbolos eléctricos/sanitarios
│   └── viewer3d/           # Componentes react-three-fiber
│
├── lib/                    # ⭐ Lógica reutilizable, SIN JSX
│   ├── api/                # Cliente HTTP hacia el backend REST
│   │   ├── client.ts       # fetch wrapper (base URL, headers, errores)
│   │   └── projects.ts     # funciones por recurso: getProject, saveElements...
│   ├── store/              # stores de zustand (editorStore.ts)
│   ├── pdf/                # lógica de export a PDF
│   ├── geometry/           # helpers de cálculo (área, snap, distancias)
│   ├── schemas/            # schemas de zod (tipos compartidos con la API)
│   └── utils/              # helpers genéricos (formato, clsx, etc.)
│
├── hooks/                  # Custom hooks (useCanvas, useSelection...)
└── types/                  # Tipos TypeScript globales
```

## Autenticación

La gestión de usuarios y el login (OAuth con Google, GitHub, etc.) se delega a **Clerk**, en su capa gratuita. No se maneja login ni sesiones a mano.

- Se usa el SDK oficial **@clerk/nextjs**, que envuelve la app y expone el usuario logueado y el token de sesión.
- Clerk emite un **JWT** que se envía en cada request al backend (header `Authorization: Bearer <token>`), y el backend lo valida para proteger los endpoints.
- La config de Clerk (provider, middleware, wrappers) vive en `lib/auth/` y en el middleware de Next.

## Reglas

- **`lib/` = todo lo reutilizable y sin UI.** Si una función no renderiza, va en `lib/`, no en el componente.
- **`app/` solo orquesta.** Nada de lógica pesada en las páginas: importan de `lib/` y `components/`.
- **Toda llamada al backend pasa por `lib/api/`.** Ningún componente hace `fetch` directo.
- **Un store de zustand por dominio** (editor, proyecto). No un store gigante.
- **Tipos compartidos con la API viven en `lib/schemas/` (zod)** y se derivan con `z.infer`.
- Componentes con JSX en `components/` o `app/`. Nunca en `lib/`.