import { Check, Minus, Plus, Search, ShoppingBag, WalletCards } from 'lucide-react'
import { money, number } from '../lib/format'
import { stockStatus, unitLabel } from '../lib/inventory'

export function SalesView({
  products,
  query,
  setQuery,
  cart,
  payment,
  setPayment,
  total,
  saleDone,
  addProduct,
  changeQuantity,
  clearCart,
  finishSale,
  canSell,
}) {
  const categories = [...new Set(products.map((product) => product.category))].sort()
  const visibleProducts = products.filter((product) =>
    [product.name, product.category, product.barcode].some((value) =>
      String(value).toLowerCase().includes(query.toLowerCase()),
    ),
  )

  return (
    <section className="sales-layout">
      <div className="catalog-panel">
        <label className="search">
          <Search size={20} aria-hidden="true" />
          <input
            autoFocus
            aria-label="Buscar producto, categoría o código"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por producto, categoría o código"
          />
        </label>
        <div className="category-row">
          <button className="chip selected" onClick={() => setQuery('')}>
            Todos
          </button>
          {categories.map((category) => (
            <button className="chip" key={category} onClick={() => setQuery(category)}>
              {category}
            </button>
          ))}
        </div>
        <div className="product-grid">
          {visibleProducts.map((product) => {
            const status = stockStatus(product)
            return (
              <button
                className="product-card"
                key={product.id}
                onClick={() => addProduct(product)}
                disabled={product.stock <= 0 || !canSell}
              >
                <div className="product-visual" style={{ background: product.color }}>
                  {product.emoji}
                </div>
                <div className="product-info">
                  <strong>{product.name}</strong>
                  <span>
                    {money.format(product.price)} / {product.unit}
                  </span>
                  <small className={['low', 'critical'].includes(status.level) ? 'stock-low' : ''}>
                    {unitLabel(product.stock, product.unit)} en stock
                  </small>
                </div>
                <span className="add-circle">
                  <Plus size={17} aria-hidden="true" />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <aside className="cart-panel">
        <div className="cart-header">
          <div>
            <h2>Venta actual</h2>
            <span>{cart.length ? `${cart.length} productos` : 'Sin productos'}</span>
          </div>
          {cart.length > 0 && (
            <button className="clear" onClick={clearCart}>
              Limpiar
            </button>
          )}
        </div>
        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <div>
                <ShoppingBag size={32} aria-hidden="true" />
              </div>
              <strong>Tu venta está vacía</strong>
              <span>Elegí productos para agregarlos acá.</span>
            </div>
          ) : (
            cart.map((item) => (
              <div className="cart-item" key={item.id}>
                <div className="mini-emoji" style={{ background: item.color }}>
                  {item.emoji}
                </div>
                <div className="cart-name">
                  <strong>{item.name}</strong>
                  <span>
                    {money.format(item.price)} / {item.unit}
                  </span>
                </div>
                <div className="qty">
                  <button
                    aria-label={`Reducir cantidad de ${item.name}`}
                    onClick={() => changeQuantity(item.id, -1)}
                  >
                    <Minus size={14} />
                  </button>
                  <b>{number.format(item.qty)}</b>
                  <button
                    aria-label={`Aumentar cantidad de ${item.name}`}
                    onClick={() => changeQuantity(item.id, 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <strong>{money.format(item.price * item.qty)}</strong>
              </div>
            ))
          )}
        </div>
        <div className="cart-footer">
          <div className="total">
            <span>Total</span>
            <strong>{money.format(total)}</strong>
          </div>
          <div className="payment-types">
            {['Efectivo', 'Tarjeta', 'Transferencia'].map((type) => (
              <button
                key={type}
                onClick={() => setPayment(type)}
                className={payment === type ? 'payment chosen' : 'payment'}
                disabled={!canSell}
              >
                <WalletCards size={17} aria-hidden="true" />
                {type}
              </button>
            ))}
          </div>
          <button
            className="charge-button"
            disabled={!cart.length || !canSell}
            onClick={finishSale}
          >
            {saleDone ? (
              <>
                <Check size={20} /> Venta registrada
              </>
            ) : (
              <>Cobrar {total ? money.format(total) : ''}</>
            )}
          </button>
        </div>
      </aside>
    </section>
  )
}
