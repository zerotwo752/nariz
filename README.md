# Nail Beauty - Plataforma inteligente de reservas

Aplicación SaaS-ready para salones de manicure y nail art. Incluye frontend responsive para Vercel, backend Node/Express para Render y esquema PostgreSQL compatible con Neon.

## Estructura

- `frontend/`: landing/dashboard responsive inspirado en la plantilla de referencia.
- `backend/`: API REST para autenticación, servicios, reservas, cotización IA preliminar y reportes.
- `backend/src/schema.sql`: tablas iniciales para Neon PostgreSQL.
- `vercel.json`: despliegue del frontend.
- `render.yaml`: despliegue del backend en Render.

## Variables de entorno

Backend:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=change-me
CORS_ORIGIN=https://tu-frontend.vercel.app
PORT=4000
```

Frontend:

```bash
VITE_API_URL=https://tu-backend.onrender.com
```

## Comandos

```bash
npm install
npm --workspace frontend run dev
npm --workspace frontend run build
npm --workspace backend start
```
