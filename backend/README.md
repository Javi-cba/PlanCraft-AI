# Backend — Guía de estructura

Stack: **Python + FastAPI**, REST API. ORM **SQLAlchemy 2.0**, migraciones **Alembic**, base **Neon (Postgres)**, IA con el **SDK de Python** (Anthropic/OpenAI), opcionalmente vía **AI Gateway de Vercel** como endpoint.

> Nota: el Vercel AI SDK es de JS/TS y no existe en Python. Acá se usa el SDK de Python apuntando, si se quiere, a la URL del AI Gateway.

## Librerías definitivas

- **fastapi** — framework de la REST API, async.
- **uvicorn** — servidor ASGI.
- **sqlalchemy** (2.0) — ORM.
- **alembic** — migraciones.
- **psycopg** (o `psycopg2-binary`) — driver de Postgres para Neon.
- **pydantic** + **pydantic-settings** — validación y config por entorno.
- **anthropic** / **openai** — SDK del LLM.
- **instructor** — fuerza salida estructurada del LLM validada con Pydantic.
- **python-dotenv** — variables de entorno.
- **pyjwt** (o **clerk-backend-api**) — validación del JWT de Clerk.

## Estructura de carpetas

```
app/
├── main.py                 # Crea la app FastAPI, monta routers y middlewares
│
├── api/                    # Endpoints REST (solo routing y validación)
│   ├── routes/
│   │   ├── projects.py
│   │   ├── elements.py
│   │   └── ai.py           # endpoint de generación con IA
│   └── deps.py             # dependencias (get_db, auth)
│
├── services/               # ⭐ Lógica de negocio. Los routers la llaman.
│   ├── project_service.py
│   ├── element_service.py
│   └── ai_service.py       # arma prompt, llama al LLM, valida salida
│
├── db/                     # Todo lo de base de datos
│   ├── session.py          # ⭐ Engine + SessionLocal (conexión a Neon)
│   ├── base.py             # Base declarativa de SQLAlchemy
│   ├── models/             # Modelos ORM (una clase por tabla)
│   └── seeds/              # Datos de demo (usuarios ficticios)
│
├── ai/                     # Config de IA reutilizable
│   ├── provider.py         # cliente del SDK (o AI Gateway) configurado
│   ├── prompts.py          # plantillas de prompt
│   └── schemas.py          # modelos Pydantic del output esperado del LLM
│
├── schemas/                # Modelos Pydantic de request/response de la API
│   ├── project.py
│   └── element.py
│
├── lib/                    # ⭐ Utilidades reutilizables, sin lógica de negocio
│   ├── errors.py           # excepciones custom + handlers
│   └── responses.py        # helpers de respuesta estándar
│
├── core/
│   └── config.py           # Settings con pydantic-settings (lee el entorno)
│
└── migrations/             # Alembic
```

## Reglas

- **La conexión a la DB vive SOLO en `db/session.py`.** El resto pide la sesión vía `Depends(get_db)`; nunca se crea otro engine.
- **`api/routes/` no tiene lógica.** Valida el request con un schema Pydantic, llama a un `service` y devuelve la respuesta.
- **`services/` = lógica de negocio.** Es lo único que habla con `db/` y con `ai/`.
- **Modelos ORM (`db/models/`) ≠ schemas Pydantic (`schemas/`).** No mezclar: el ORM es la tabla, el schema es lo que entra/sale por la API.
- **Todo lo de IA (provider, prompts, schemas) vive en `ai/`.** `ai_service` lo consume.
- **El output del LLM SIEMPRE se valida** con un modelo Pydantic de `ai/schemas.py` (usar `instructor`) antes de tocar la DB.
- **`lib/` = helpers genéricos** (errores, respuestas). Nada de negocio ni de DB.
- **`core/config.py` valida el entorno al arrancar.** Si falta una var, la app no levanta.
- **`db/seeds/` solo escribe bajo `user_mock_`.** Es el prefijo que separa la demo de las cuentas reales; Clerk nunca emite un id así, y el borrado del seed se filtra siempre por él.
- REST: sustantivos en plural, verbos por método HTTP. `GET /projects/{id}`, `POST /projects/{id}/elements`, `POST /ai/generate`.

## Datos de demo

Seis proyectos públicos de usuarios ficticios (casa, monoambiente, dúplex de dos plantas, oficina con subsuelo, local comercial y departamento), con sus plantas dibujadas y las instalaciones eléctrica, sanitaria y de gas.

```bash
python -m app.db.seeds              # inserta/reemplaza la demo (idempotente)
python -m app.db.seeds --dry-run    # muestra qué escribiría, sin tocar la DB
python -m app.db.seeds --purge      # borra solo la demo
```

Es idempotente por reemplazo: borra los proyectos `user_mock_*` y los vuelve a insertar, así que correrlo dos veces no duplica nada. Las plantas se arman con `db/seeds/layouts.py`, el gemelo en Python de `frontend/src/lib/plans/templates.ts` — misma geometría, ids secuenciales en vez de aleatorios para que dos corridas den el mismo dibujo.

## Autenticación

Los usuarios y el login (OAuth) se delegan a **Clerk**, en su capa gratuita. El backend no maneja passwords ni sesiones a mano.

- El front manda el **JWT de Clerk** en el header `Authorization: Bearer <token>` de cada request.
- Una dependencia en `api/deps.py` (ej: `get_current_user`) valida ese JWT contra las llaves públicas de Clerk (JWKS) y protege los endpoints.
- Los endpoints que requieren usuario logueado usan esa dependencia vía `Depends(get_current_user)`.
- Se puede usar el SDK **clerk-backend-api** (Python) o validar el JWT a mano con la librería `pyjwt` contra el JWKS de Clerk.
- La config de Clerk (secret key, dominio JWKS) vive en `core/config.py` y la lógica de validación en un helper de `lib/`.

## Variables de entorno mínimas

```
DATABASE_URL=        # connection string de Neon (postgresql+psycopg://...)
ANTHROPIC_API_KEY=   # o OPENAI_API_KEY
AI_GATEWAY_URL=      # opcional, si se enruta por el AI Gateway de Vercel
CLERK_SECRET_KEY=    # credencial de Clerk para validar el JWT
CLERK_JWKS_URL=      # endpoint JWKS de Clerk para verificar la firma
```