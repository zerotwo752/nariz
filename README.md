# Nail Beauty Platform

Aplicación para salón de belleza con frontend en Vite/React y backend en Express/PostgreSQL.

## Ejecutar frontend y backend por separado

Instala dependencias desde la raíz del proyecto:

```bash
npm install
```

Copia `backend/env.example` a `backend/.env` y configura tus credenciales de PostgreSQL/JWT. El backend también lee un `.env` en la raíz del proyecto, pero `backend/.env` tiene prioridad.

Para Neon, en `DATABASE_URL` pega solo la URL que empieza por `postgresql://`; no incluyas el comando `psql` ni las comillas que muestra el panel. Ejemplo:

```env
DATABASE_URL=postgresql://neondb_owner:TU_PASSWORD@ep-tu-host-pooler.region.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

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

La carpeta `backend/database` contiene el esquema, el seed seguro de arranque y un script manual de limpieza.

El backend crea/actualiza las tablas automáticamente al iniciar (`npm run backend:dev` o `npm start`) y ejecuta `backend/database/seed.sql`. Ese seed es seguro para uso normal: no borra reservas, servicios, productos, clientas ni trabajadoras existentes; solo intenta crear catálogos mínimos y cuentas iniciales si todavía no existen. Si quieres ejecutar la inicialización manualmente, usa:

```bash
npm --workspace backend run db:init
```

Si necesitas iniciar el backend sin tocar la base de datos, define `SKIP_DB_INIT=true`.

También puedes ejecutar los SQL directamente con `psql`:

```bash
psql "$DATABASE_URL" -f backend/database/schema.sql
psql "$DATABASE_URL" -f backend/database/seed.sql
```

### Limpieza manual de Neon una sola vez

Si quieres borrar a mano los datos actuales de Neon y empezar limpio, ejecuta **una sola vez**:

```bash
psql "$DATABASE_URL" -f backend/database/manual-clean-reset.sql
```

Ese script borra catálogos de servicios, tienda virtual, reservas en cualquier estado, pagos, cotizaciones, trabajadoras/especialistas y usuarios existentes. Después deja únicamente estas cuentas:

- `SA` / `SA`: súper admin.
- `Dueña` / `Dueña`: dueña del salón.
- `Cliente` / `Cliente`: cliente inicial.

No dejes ese script configurado en el arranque de la app; úsalo solo desde la consola cuando quieras reiniciar la data manualmente.
