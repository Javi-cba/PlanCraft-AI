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

## Comunicación con el backend

El backend es una **API REST separada en FastAPI (Python)**. El front NO tiene backend propio: no se usan Route Handlers ni Server Actions como capa de API. Toda la lógica y la DB viven en FastAPI, así que un Server Action que solo reenvíe la llamada sería un **proxy vacío** (código duplicado + salto de red extra). No se hace.

**Regla general: las peticiones van DIRECTO a FastAPI**, siempre a través de `lib/api/`, nunca con `fetch` suelto en un componente. Dónde se dispara la llamada depende del tipo de componente:

- **Client Components** (todo el editor interactivo: konva, zustand, formularios) → llaman a `lib/api/` directamente. El token de Clerk se obtiene en el cliente con `useAuth().getToken()` y `lib/api/client.ts` lo mete en el header `Authorization: Bearer <token>`.

```ts
// dentro de un client component
const { getToken } = useAuth();
const token = await getToken();
// lib/api/client.ts se encarga de agregar el header y parsear errores
await api.projects.create(data, token);
```

- **Server Components** (carga inicial / SSR: ej. la lista de proyectos al abrir el dashboard) → obtienen el token del lado server con `auth()` de `@clerk/nextjs/server` y llaman a FastAPI en el render.

```ts
// server component
import { auth } from "@clerk/nextjs/server";
const { getToken } = await auth();
const token = await getToken();
// fetch a FastAPI corriendo en el server
```

**Frontera de seguridad:** es FastAPI validando el JWT de Clerk en cada request. El `external_user_id` SIEMPRE lo deriva el backend del token validado, nunca lo manda el front en el body ni en query params.

**Manejo de errores:** `lib/api/client.ts` parsea el formato de error estándar del backend `{ error: { code, message } }` y lanza un `ApiError(code, message, status)`. El `message` viene en español, listo para mostrar en un toast/banner de la UI.

> La URL base de FastAPI se lee de una env var pública (`NEXT_PUBLIC_API_URL`). El backend debe tener CORS configurado para permitir SOLO el origin del front y el header `Authorization`.

## Reglas

- **`lib/` = todo lo reutilizable y sin UI.** Si una función no renderiza, va en `lib/`, no en el componente.
- **`app/` solo orquesta.** Nada de lógica pesada en las páginas: importan de `lib/` y `components/`.
- **Toda llamada al backend pasa por `lib/api/`.** Ningún componente hace `fetch` directo.
- **Las llamadas van directo a FastAPI.** Nada de Route Handlers ni Server Actions de Next como proxy del backend.
- **Client Component → token con `useAuth().getToken()`; Server Component → token con `auth()` server-side.** Ambos llaman a FastAPI vía `lib/api/`.
- **Un store de zustand por dominio** (editor, proyecto). No un store gigante.
- **Tipos compartidos con la API viven en `lib/schemas/` (zod)** y se derivan con `z.infer`.
- Componentes con JSX en `components/` o `app/`. Nunca en `lib/`.