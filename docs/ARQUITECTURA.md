# Arquitectura de MiKiosco

MiKiosco se implementa como una aplicación multi-tenant: una **organización** puede tener una o más **sucursales**, y todos los recursos operativos pertenecen a una sucursal. Los usuarios reciben un rol por sucursal.

## Capas

| Capa           | Tecnología               | Responsabilidad                                                  |
| -------------- | ------------------------ | ---------------------------------------------------------------- |
| Cliente        | React, Vite, PWA         | POS optimista y consola operativa adaptable a tablet/PC          |
| API            | Vercel Functions         | Validación, autorización y reglas de negocio                     |
| Datos          | PostgreSQL               | Fuente de verdad, auditoría y aislamiento por sucursal           |
| Sincronización | Cola local del navegador | Conserva ventas creadas sin conexión y las publica al reconectar |

## Principios de negocio

1. El stock nunca se modifica directamente: cada ajuste crea un movimiento auditable.
2. Una venta confirmada descuenta stock dentro de una transacción de base de datos.
3. La caja es por sucursal y turno: debe abrirse antes de cobrar y cerrarse con arqueo.
4. La cuenta corriente aumenta con ventas a crédito y disminuye con cobros asociados.
5. Todas las consultas operativas se limitan a la sucursal habilitada para el usuario.

## Antes de salida comercial

1. Crear una base PostgreSQL y aplicar `db/schema.sql`.
2. Cargar `DATABASE_URL` y `AUTH_SECRET` como variables protegidas en Vercel.
3. Integrar AFIP/ARCA según el tipo de comprobante requerido por el comercio.
4. Configurar impresoras compatibles y políticas de copias de seguridad.
