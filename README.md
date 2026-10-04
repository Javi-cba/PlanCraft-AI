# PlanCraft AI

Editor de planos arquitectónicos donde **dibujás hablando**. Describís la casa en castellano y el asistente la traza: paredes, puertas, ventanas y ambientes con medidas reales.


## El asistente de IA

Corre sobre **Claude Sonnet 5** y no devuelve texto: devuelve **operaciones sobre el plano** que se aplican al lienzo al instante.

### Qué le podés pedir

**Dibujar desde cero**

> "Una casa de tres dormitorios, cocina, baño y living comedor."

Levanta el perímetro, divide los ambientes, pone las puertas y ventanas donde van, y nombra cada espacio.

**Retocar lo que ya está dibujado**

> "Agrandá el baño 50 cm hacia el pasillo."
> "Dividí la sala del comedor con un tabique a media altura."
> "Agregale una ventana a cada dormitorio."
> "Cambiá la puerta del baño para que abra hacia adentro."

Toca **solo lo que le pediste**. No te vuelve a dibujar la casa entera ni te pisa el trabajo manual.

**Sumar plantas**

> "Sumá una planta alta con dos dormitorios y baño."

Crea la planta nueva alineada con la de abajo: la escalera cae en el mismo lugar, el perímetro portante se repite y el baño queda sobre la columna sanitaria.

**Preguntar**

Si el pedido es ambiguo, no adivina: repregunta.

### Por qué no te rompe el plano

- **Sabe de arquitectura.** Pared exterior 20 cm, interior 12. Dormitorio 300x350, baño 160x220, pasillo de 100 a 120. Puerta de entrada 90, interior 80, baño 70. Toda habitación lleva puerta; dormitorios y living, ventana a exterior.
- **Las esquinas cierran.** Coordenadas exactas, nada de paredes con 1 cm de luz.
- **Nada se aplica a medias.** Cada operación se valida sola: si una sale mal, se descarta *esa* y te dice por qué, en castellano. Las otras entran igual.
- **No guarda nada solo.** El resultado cae en el lienzo y en tu pila de undo. Revisás, `⌘Z` si no te gustó, y guardás vos.
- **Ve el lienzo, no la última versión guardada.** Movés una pared a mano y el siguiente mensaje ya la tiene en cuenta.
- **Cuesta visible.** Cada respuesta informa modelo y tokens consumidos.

## El resto del editor

- **Dibujo manual completo** — paredes, puertas, ventanas y ambientes, con trazado ortogonal, snap a grilla y paso configurable (1 a 50 cm). Undo/redo de todo, venga de tu mano o de la IA.
- **Plantillas** — Monoambiente, Departamento 2 ambientes, Casa 3 dormitorios, o por pieza suelta (Cocina, Baño, Dormitorio, Estar comedor).
- **Proyectos multi-planta** — Sótano, Planta Baja, Planta Alta, Ático. Cada una con su plano y su chat propio.
- **Instalaciones** — capas Eléctrica, Sanitaria y Gas trazadas sobre las mismas paredes, así las tres nunca se desincronizan.
- **Superficies automáticas** — m² por ambiente y totales, recalculados a medida que dibujás.

## Stack

| | |
|---|---|
| Frontend | Next.js 15 + React, canvas propio, Clerk para auth — en AWS Amplify |
| Backend | FastAPI + SQLAlchemy sobre AWS Lambda (Mangum) |
| Base | Postgres (Neon) |
| IA | Claude Sonnet 5 vía SDK, salida estructurada con instructor |

## Arrancar

```bash
bun run setup   # instala todo y crea los .env
bun run dev     # web :3000 + api :8000
```

[image](https://github.com/user-attachments/assets/91670a24-d26a-4176-80aa-429a6d773a62)
