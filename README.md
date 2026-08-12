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
