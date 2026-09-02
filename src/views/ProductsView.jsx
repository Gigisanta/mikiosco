import { money } from '../lib/format'
import { unitLabel } from '../lib/inventory'

export function ProductsView({ products }) {
  return (
    <section className="management">
      <div className="manage-header">
        <p>Catálogo de productos, precios y unidades de venta.</p>
      </div>
      <div className="inventory-list">
        {products.map((product) => (
          <div className="inventory-row" key={product.id}>
            <div className="mini-emoji" style={{ background: product.color }}>
              {product.emoji}
            </div>
            <strong>{product.name}</strong>
            <span>{product.category}</span>
            <b>
              {money.format(product.price)} / {product.unit}
            </b>
            <span className={product.stock <= product.min ? 'stock-pill warning' : 'stock-pill'}>
              {unitLabel(product.stock, product.unit)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
