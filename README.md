# MiKiosco

MiKiosco es una aplicación web de gestión para kioscos: ventas, caja, inventario, clientes y reportes en una interfaz de uso rápido.

## Arquitectura

- **Frontend:** React + Vite, responsive y PWA.
- **Backend:** funciones serverless de Vercel en `api/`.
- **Base de datos:** PostgreSQL (Neon/Vercel Postgres compatible). El modelo SQL está en `db/schema.sql`.
- **Autenticación:** JWT firmado con `AUTH_SECRET` y roles `ADMIN`, `CASHIER`, `VIEWER`.
- **Offline:** el POS guarda temporalmente ventas y catálogo en el navegador; al volver la conexión las ventas se sincronizan.

## Inicio local

```bash
npm install
npm run dev
```

## Variables de producción

```bash
DATABASE_URL=postgresql://...
AUTH_SECRET=una-clave-aleatoria-larga
VITE_DEMO_MODE=false
```

El frontend inicia en modo demostración por defecto para permitir recorridos comerciales. Definí
`VITE_DEMO_MODE=false` junto con la base y el secreto para usar datos reales.

Aplicá, en orden, los archivos de `db/migrations/` sobre una base existente. Para una instalación
nueva también podés ejecutar `db/schema.sql`.

Para crear la primera organización, sucursal y administrador después de aplicar el esquema:

```bash
node --env-file=.env.local scripts/setup-schema.mjs
DATABASE_URL=postgresql://... ADMIN_EMAIL=admin@kiosco.com ADMIN_PASSWORD=una-clave-segura npm run create-admin
```

En producción, la información compartida se refresca cada 12 segundos y al volver a la pestaña.
Los administradores pueden descargar un respaldo JSON completo desde Resumen. Recomendamos además
habilitar los backups automáticos del proveedor PostgreSQL.

## Módulos incluidos

- Punto de venta con pagos mixtos, vuelto y ticket imprimible.
- Inventario por unidad, kg, g, litros, ml, packs, cajas o metros, con mínimos y máximos.
- Importación y exportación de stock en Excel mediante una plantilla validada.
- Clientes, cuenta corriente y proveedores (modelo de datos + API).
- Caja, gastos, arqueos y resumen diario.
- Estadísticas mensuales de ventas, ganancia, categorías, rotación y margen por producto.

Consulta [la arquitectura](docs/ARQUITECTURA.md) antes de configurar producción.
