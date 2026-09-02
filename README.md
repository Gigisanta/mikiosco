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
```

Sin `DATABASE_URL` la aplicación inicia en modo demostración para permitir recorridos comerciales y desarrollo de interfaz.

## Módulos incluidos

- Punto de venta con pagos mixtos, vuelto y ticket imprimible.
- Inventario por unidad, kg, g, litros, ml, packs, cajas o metros, con mínimos y máximos.
- Importación y exportación de stock en Excel mediante una plantilla validada.
- Clientes, cuenta corriente y proveedores (modelo de datos + API).
- Caja, gastos, arqueos y resumen diario.
- Estadísticas mensuales de ventas, ganancia, categorías, rotación y margen por producto.

Consulta [la arquitectura](docs/ARQUITECTURA.md) antes de configurar producción.
