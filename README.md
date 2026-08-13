# PlanCraft AI

Aplicación web para generar planos de instalaciones (eléctricas, sanitarias y afines) a partir de descripciones en lenguaje natural. El usuario describe un ambiente o proyecto mediante un prompt, la IA propone la distribución de los elementos sobre la planta, y desde ahí puede editar todo manualmente en un editor 2D, visualizar algunos detalles en 3D y exportar el resultado a PDF.

La idea es acortar el trabajo repetitivo del anteproyecto: pasar de la descripción a un borrador editable en minutos, dejando la revisión y los ajustes finos en manos del usuario.

## Stack

**Frontend**
- Next.js + React + TypeScript
- Editor de planos en canvas 2D
- Vista 3D para detalles puntuales
- Exportación a PDF
- TODO EL CODIGO DEBE IR EN INGLES PERO TODO LO Q ES UI DEL USUARIO EN ESPAÑOL.

**Backend**
- Python + FastAPI (REST API)
- SQLAlchemy sobre Postgres (Neon)
- Integración con IA para la generación a partir de prompts
- TODO EL CODIGO DEBE IR EN INGLES.

**Auth**
- Clerk (OAuth). El front manda el JWT en `Authorization: Bearer`, el back lo valida contra el JWKS de Clerk.

## Comandos

Dos comandos, los dos con bun desde la raíz:

```bash
bun run setup   # instala dependencias del front y del back, y crea los .env
bun run dev     # levanta los dos servicios; Ctrl+C corta ambos
```

| | |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| Docs de la API | http://localhost:8000/docs |

Para levantar uno solo:

```bash
bun run dev:web   # solo Next.js
bun run dev:api   # solo FastAPI
```

Otros:

```bash
bun run build   # build de producción del front
bun run lint    # eslint del front
```

Los puertos se pueden cambiar: `WEB_PORT=3001 API_PORT=8001 bun run dev`.

### Qué hace cada uno

`setup` corre `bun install` en `frontend/`, y en `backend/` crea el virtualenv (`.venv`) e instala `requirements.txt` con pip — bun no instala paquetes de Python, así que ahí solo orquesta. También copia los `.env.example` a `.env` / `.env.local` si todavía no existen, sin pisar los que ya tengas.

`dev` corre uvicorn con `--reload` y `next dev` en paralelo. Es un script (`scripts/dev.sh`), no una dependencia de node: no hay `node_modules` en la raíz.

### Requisitos

- **bun** ≥ 1.3
- **Node** 22 LTS o 24 (con la 23 algunos paquetes avisan `EBADENGINE`)
- **Python** 3.11+

### Antes del primer `bun run dev`

Completá las variables en `backend/.env` (Neon + Clerk) y `frontend/.env.local` (claves de Clerk). Sin las claves de Clerk el front levanta igual, pero el login no funciona.
