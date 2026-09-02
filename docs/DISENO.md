# Sistema visual MiKiosco

## Lectura de diseño

Aplicación operativa B2B para dueños y cajeros de kioscos, con lenguaje sereno, confiable y de alta densidad. La base elegida es un sistema nativo de tokens propios, con patrones de accesibilidad y jerarquía compatibles con productos empresariales modernos.

## Auditoría y decisión

El POS existente tenía una estructura clara, un acento verde y una jerarquía funcional que se preservan. Se retiraron dependencias visuales remotas, se definieron tokens semánticos, soporte automático de modo oscuro, foco visible, movimiento reducido y una escala coherente de radios.

Taste Skill está pensado principalmente para superficies de marketing. En este producto se aplica donde corresponde: lectura de brief, accesibilidad, consistencia de color, forma y estados. Las áreas densas de operación mantienen patrones de producto, sin convertir el POS en una landing.

## Diales

| Variable         | Valor | Motivo                                                     |
| ---------------- | ----- | ---------------------------------------------------------- |
| DESIGN_VARIANCE  | 3     | Las cajas y ventas requieren familiaridad y lectura veloz. |
| MOTION_INTENSITY | 2     | El movimiento se limita al feedback táctil.                |
| VISUAL_DENSITY   | 7     | Un cajero necesita ver información útil sin navegar.       |

## Tokens

- Acento: verde pino `#087b56`.
- Superficies: blanco suave y verde grisáceo, con equivalentes oscuros.
- Radio: 8px en controles, 12px en contenedores y círculo solo para acciones compactas.
- Tipografía: pila local de sistema para evitar bloquear la carga por fuentes externas.
- Estados: foco de alto contraste, pulsación táctil y reducción de movimiento por preferencia del sistema.
