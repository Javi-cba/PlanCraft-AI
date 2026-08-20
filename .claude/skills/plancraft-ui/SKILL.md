---
name: plancraft-ui
description: Use when building or editing ANY page, section or visual component in the PlanCraft AI frontend (frontend/src/**) — landing, 404, dashboard, editor screens. Carries the established look: warm paper + navy palette, Outfit/Inter typography, floating 3D model treatment, rounded dark panels and blueprint-grid backgrounds. Also covers preparing new 3D renders (cutting the checkerboard background out) and how to verify a page visually without the Chrome extension.
---

# Estilo visual de PlanCraft AI

El look ya está definido y vive en el código. **No lo re-inventes**: leé
`frontend/src/app/globals.css` y `frontend/src/components/home/Hero.tsx` antes de
escribir una página nueva, y reutilizá los patrones de abajo.

## Paleta y tipografía

Todos los tokens están en `@theme` de `frontend/src/app/globals.css`. Usalos
siempre por nombre — nunca hardcodees un hex en un componente.

| Rol | Tokens | Uso |
|---|---|---|
| Papel (fondo) | `paper-50 … paper-300` | fondo de página (`bg-paper-100`), tarjetas (`bg-paper-50`), bordes (`border-paper-300/70`) |
| Tinta (oscuro) | `ink-700 … ink-900` | texto (`text-ink-800`), paneles oscuros (`bg-ink-900`) |
| Marca (azul del techo) | `blueprint-400 … blueprint-700` | acento principal, botones, títulos destacados |
| Madera (acento cálido) | `timber-300 … timber-600` | eyebrows, símbolos de planos, hovers sobre oscuro |

- **Display**: `font-display` (Outfit) para h1/h2/h3 y números grandes.
- **Texto**: `font-sans` (Inter) por defecto, ya aplicado en `body`.
- Ambas se cargan con `next/font/google` en `layout.tsx` como variables CSS.

## Anatomía de una página

El ritmo es: **papel → panel oscuro redondeado → papel → banda azul**. Alterná
fondos, nunca dos secciones oscuras seguidas.

```tsx
// Sección sobre papel, con grilla de plano que se desvanece
<section className="relative overflow-hidden">
  <div aria-hidden="true"
    className="pointer-events-none absolute inset-0 grid-paper text-blueprint-600 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
  <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8">…</div>
</section>

// Panel oscuro (el que corta la página en dos)
<section className="px-3 pb-6 sm:px-5">
  <div className="relative overflow-hidden rounded-[2rem] bg-ink-900 px-5 py-16 sm:rounded-[2.5rem] sm:px-10 lg:px-14 lg:py-20">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid-paper-fine text-paper-50 opacity-70" />
    …
  </div>
</section>
```

Utilidades propias: `grid-paper` (celda 32px) y `grid-paper-fine` (8px). Toman
el color de `currentColor`, así que se tiñen con `text-*`.

### Encabezado de sección

```tsx
<p className="text-xs font-semibold tracking-[0.22em] text-timber-600 uppercase">Eyebrow corto</p>
<h2 className="mt-4 font-display text-4xl leading-[1.05] font-light tracking-tight text-ink-900 sm:text-5xl">
  Palabras livianas <span className="font-semibold text-blueprint-600">y el foco en negrita</span>
</h2>
```

El contraste `font-light` + `font-semibold` en el mismo título es la firma
tipográfica del proyecto. Sobre oscuro: `text-paper-50` y el span sin color.

### Botones

- Primario: `rounded-full bg-blueprint-600 px-7 py-3.5 text-sm font-medium text-paper-50 shadow-lg shadow-blueprint-600/20 transition hover:-translate-y-0.5 hover:bg-blueprint-700 motion-reduce:hover:translate-y-0`
- Secundario: `rounded-full border border-blueprint-600/25 px-7 py-3.5 text-sm font-medium text-blueprint-700 hover:border-blueprint-600/60 hover:bg-paper-50`
- Sobre panel oscuro: `rounded-full bg-paper-50 px-7 py-3.5 text-xs font-semibold tracking-[0.12em] text-ink-900 uppercase hover:bg-timber-300`

Siempre `rounded-full`. Las tarjetas, en cambio, van `rounded-3xl` y levantan en
hover (`hover:-translate-y-1 hover:shadow-xl` + `motion-reduce:hover:translate-y-0`).

## Las maquetas 3D

Todo render 3D pasa por `frontend/src/components/ui/FloatingModel.tsx`, que da el
efecto completo: flota (`animate-float`), proyecta sombra de contacto, tiene luz
detrás y gira siguiendo el puntero. **No dupliques el efecto**, usá el componente:

```tsx
<FloatingModel
  src="/house-3d.png"
  alt="Descripción real de lo que se ve"
  width={1800}
  height={983}
  sizes="(min-width: 1024px) 55vw, 92vw"
  priority          // solo si está sobre el fold
  maxTilt={7}       // 0 desactiva el giro
/>
```

Reglas: `sizes` es obligatorio (las imágenes son grandes), `priority` solo arriba
del fold, y el `alt` describe la maqueta, no dice "imagen de".

### Preparar un render nuevo

Las imágenes que llegan tienen el **damero de transparencia pintado** (son JPEG
o PNG sin alpha). Hay que recortarlo antes de usarlas, o se ve el cuadriculado.
Usá `scripts/cutout_transparent.py` de esta skill:

```bash
python3 -m venv /tmp/imgenv && /tmp/imgenv/bin/pip install pillow numpy scipy
/tmp/imgenv/bin/python .claude/skills/plancraft-ui/scripts/cutout_transparent.py \
  entrada.jpeg frontend/public/mi-modelo.png --max-width 1800
```

El script imprime qué porcentaje detectó como fondo (esperá 50-75%) y deja un
control compuesto sobre fondo oscuro: **miralo siempre**, ahí se ve cualquier
resto de damero. Guardá el resultado en `frontend/public/` con nombre en inglés
y kebab-case (`house-3d.png`, `404-3d.png`).

## Movimiento

- Animaciones definidas como tokens: `animate-float`, `animate-rise`.
- **Toda** animación o hover con desplazamiento lleva su `motion-reduce:*`.
- Efectos que siguen el puntero: solo si `(hover: hover) and (prefers-reduced-motion: no-preference)`.
- Para leer un media query en un cliente, usá `useSyncExternalStore` — el lint
  (`react-hooks/set-state-in-effect`) rechaza `setState` dentro de `useEffect`.

## Layout hero (copy + maqueta)

Para que en mobile la maqueta quede pegada al copy y en desktop ocupe la columna
derecha completa, usá colocación explícita en la grilla (el orden del DOM manda
en mobile):

```tsx
<div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)] lg:gap-x-6 lg:gap-y-10">
  <div className="lg:col-start-1 lg:row-start-1">…copy + CTAs…</div>
  <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:-mr-16 lg:self-center xl:-mr-24">…FloatingModel…</div>
  <div className="lg:col-start-1 lg:row-start-2">…specs / links…</div>
</div>
```

El margen negativo a la derecha es intencional: la maqueta sangra hacia el borde.

## Auth en los CTA

Los botones de acción se bifurcan según sesión, con los componentes de Clerk ya
usados en `SiteHeader`:

```tsx
<Show when="signed-out">
  <SignInButton mode="modal" forceRedirectUrl="/projects"><button className="…">Empezar gratis</button></SignInButton>
</Show>
<Show when="signed-in">
  <Link href="/projects" className="…">Ir a mis proyectos</Link>
</Show>
```

`/projects` es la única ruta protegida (`frontend/src/lib/auth/routes.ts`).

## Contenido

- Español rioplatense, voseo ("Diseñá", "Ajustá", "Describí").
- **Nada de datos inventados**: sin métricas, testimonios ni logos falsos. Si
  hace falta llenar un espacio, describí capacidades reales del producto.
- No linkees a rutas que todavía no existen: usá anclas de la misma página.

## Next.js 16 — trampas de este repo

- Leé `frontend/node_modules/next/dist/docs/` antes de tocar convenciones: esta
  versión cambió cosas respecto de lo que "sabés".
- El middleware se llama `src/proxy.ts` y exporta `proxy`.
- El layout tipa sus props con `LayoutProps<"/">`.
- `app/not-found.tsx` cubre las URLs no encontradas y **no** acepta `metadata`
  (eso es solo de `global-not-found.tsx`).
- Tailwind v4: no hay `tailwind.config.js`, todo va en `@theme` / `@utility`.

## Verificación obligatoria antes de cerrar

```bash
cd frontend && bunx tsc --noEmit && bun run lint && bun run build
```

Y **mirá la página**, no la imagines. Si la extensión de Chrome no está
conectada, manejá Chrome por CDP (funciona headless y respeta el viewport):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --remote-debugging-port=9222 --remote-allow-origins='*' \
  --user-data-dir=/tmp/cp --no-first-run about:blank &
/tmp/imgenv/bin/python .claude/skills/plancraft-ui/scripts/screenshot_cdp.py \
  http://localhost:3000/ 1440 900 /tmp/desktop.png
/tmp/imgenv/bin/python .claude/skills/plancraft-ui/scripts/screenshot_cdp.py \
  http://localhost:3000/ 390 844 /tmp/mobile.png --mobile
```

Dos chequeos que ya cazaron bugs acá:

1. **Overflow horizontal**: el script imprime `scrollWidth`; tiene que ser igual
   al ancho del viewport. Si no, hay un elemento que se pasa.
2. **Imágenes en blanco**: si un `<img>` no aparece en la captura, no asumas que
   está roto — el optimizador de Next puede estar frío. Calentá las variantes
   (`curl "http://localhost:3000/_next/image?url=%2Ffoo.png&w=1920&q=75"`) y
   confirmá el estado real del elemento (`complete`, `naturalWidth`) por CDP
   antes de "arreglar" nada.
