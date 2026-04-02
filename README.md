# PepShop POS

POS web para stock, ventas y caja con Next.js, Supabase y Google Drive.

## Stack

- Frontend: Next.js 16
- Persistencia principal: Supabase PostgreSQL
- Cache local y carrito: Dexie
- PDFs: `pdf-lib`
- Almacenamiento contable: Google Drive API

## Variables de entorno

Usa `.env.example` como base:

```bash
cp .env.example .env.local
```

Variables requeridas:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_DRIVE_CLIENT_EMAIL`
- `GOOGLE_DRIVE_PRIVATE_KEY`
- `GOOGLE_DRIVE_PARENT_FOLDER_ID` opcional
- `APP_LOGIN_USERNAME`
- `APP_LOGIN_PASSWORD`

Para compatibilidad del frontend tambien se esperan:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta el SQL de [supabase/schema.sql](./supabase/schema.sql).
3. Copia `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.

El flujo principal se guarda asi:

1. Registrar venta.
2. Descontar stock.
3. Insertar `ventas` y `detalle_ventas`.
4. Registrar `movimientos`.
5. Generar PDF.
6. Subir PDF a Google Drive.
7. Guardar link en `pdfs`.

## Google Drive

1. Crea una Service Account en Google Cloud.
2. Habilita Google Drive API.
3. Comparte con la service account la carpeta padre si usas `GOOGLE_DRIVE_PARENT_FOLDER_ID`.
4. La app crea automaticamente la carpeta `PepShop POS` si no existe.

## Desarrollo

```bash
npm install
npm run dev
```

## Endpoints principales

- `GET /api/auth/session`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/bootstrap`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`
- `POST /api/sales/checkout`
- `POST /api/shifts/open`
- `POST /api/shifts/:id/close`
- `POST /api/pdfs/sales/:id`
- `POST /api/pdfs/arqueos/:id`
- `GET|POST /api/clients`
- `PATCH|DELETE /api/clients/:id`

## Notas

- El carrito sigue siendo local por dispositivo para no degradar la UX.
- Catalogo, ventas, stock y turnos se hidratan desde Supabase al abrir la app.
- Los PDFs se descargan localmente y tambien quedan accesibles desde Google Drive.
