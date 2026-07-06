# Nail Beauty Platform

Aplicación para salón de belleza con frontend en Vite/React y backend en Express/PostgreSQL.

## Ejecutar frontend y backend por separado

Instala dependencias desde la raíz del proyecto:

```bash
npm install
```

Copia `backend/env.example` a `backend/.env` y configura tus credenciales de PostgreSQL/JWT.

Frontend:

```bash
npm run frontend:dev
```

Backend:

```bash
npm run backend:dev
```

También puedes ejecutar los workspaces directamente:

```bash
npm --workspace frontend run dev
npm --workspace backend run dev
```

## Base de datos

La carpeta `backend/database` contiene las tablas y datos iniciales para login, roles, productos, servicios, reservas y pagos.

```bash
psql "$DATABASE_URL" -f backend/database/schema.sql
psql "$DATABASE_URL" -f backend/database/seed.sql
```

Roles iniciales:

- `SA`: súper admin.
- `OWNER`: dueño del salón.
- `USER`: cliente/usuario final.

> Usuarios demo: `00000001` / `Admin123!`, `00000002` / `Duena123!`, `00000003` / `Andrea123!`.
