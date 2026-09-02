import { useMemo, useState } from 'react'
import { Edit3, Percent, Plus, Trash2 } from 'lucide-react'
import { money } from '../lib/format'
import { unitLabel } from '../lib/inventory'

const emptyProduct = {
  name: '',
  barcode: '',
  categoryName: '',
  supplierId: '',
  unit: 'unidad',
  costPrice: '',
  salePrice: '',
  stock: '',
  minStock: '',
  maxStock: '',
}

function adjustedPrice(price, percentage, rounding) {
  const changed = Number(price) * (1 + Number(percentage || 0) / 100)
  return Number(rounding) > 0 ? Math.ceil(changed / Number(rounding)) * Number(rounding) : changed
}

export function ProductsView({ products, suppliers, canEdit, demoMode, onSave, onDelete, onBulk }) {
  const [form, setForm] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulk, setBulk] = useState({ scope: 'all', category: '', percentage: '', rounding: '50' })
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const categories = [...new Set(products.map((product) => product.category))].sort()

  const affected = useMemo(() => {
    if (bulk.scope === 'selected')
      return products.filter((product) => selected.includes(product.id))
    if (bulk.scope === 'category') {
      return products.filter((product) => product.category === bulk.category)
    }
    return products
  }, [bulk.category, bulk.scope, products, selected])

  function edit(product) {
    setForm({
      id: product.id,
      name: product.name,
      barcode: product.barcode,
      categoryName: product.category,
      categoryId: product.categoryId,
      supplierId: product.supplierId || '',
      unit: product.unit,
      costPrice: product.cost,
      salePrice: product.price,
      stock: product.stock,
      minStock: product.min,
      maxStock: product.max,
    })
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave(form)
      setForm(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function applyBulk(event) {
    event.preventDefault()
    if (!affected.length) {
      setError('No hay productos dentro del alcance elegido.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const categoryProduct = products.find((product) => product.category === bulk.category)
      await onBulk({
        scope: bulk.scope,
        categoryId: categoryProduct?.categoryId,
        categoryName: bulk.category,
        productIds: selected,
        percentage: Number(bulk.percentage),
        rounding: Number(bulk.rounding),
      })
      setBulkOpen(false)
      setSelected([])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="management products-page">
      <div className="manage-header owner-header">
        <div>
          <p>Administrá el catálogo, los precios y las unidades de venta.</p>
          {demoMode && <small className="demo-label">Datos de ejemplo</small>}
        </div>
        {canEdit && (
          <div className="header-actions">
            <button className="secondary-action" onClick={() => setBulkOpen((value) => !value)}>
              <Percent size={17} /> Aumento masivo
            </button>
            <button className="primary compact-primary" onClick={() => setForm(emptyProduct)}>
              <Plus size={17} /> Agregar producto
            </button>
          </div>
        )}
      </div>

      {form && (
        <form className="product-form" onSubmit={save}>
          <div className="panel-title">
            <div>
              <h2>{form.id ? 'Editar producto' : 'Nuevo producto'}</h2>
              <p>Completá precios y límites para automatizar el control.</p>
            </div>
          </div>
          {[
            ['name', 'Nombre', 'text'],
            ['barcode', 'Código de barras', 'text'],
            ['categoryName', 'Categoría', 'text'],
            ['costPrice', 'Costo', 'decimal'],
            ['salePrice', 'Venta', 'decimal'],
            ['stock', 'Stock actual', 'decimal'],
            ['minStock', 'Mínimo', 'decimal'],
            ['maxStock', 'Máximo (0 sin tope)', 'decimal'],
          ].map(([field, label, mode]) => (
            <label key={field}>
              {label}
              <input
                required={['name', 'salePrice'].includes(field)}
                inputMode={mode}
                value={form[field]}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
              />
            </label>
          ))}
          <label>
            Unidad de medida
            <select
              value={form.unit}
              onChange={(event) => setForm({ ...form, unit: event.target.value })}
            >
              {['unidad', 'kg', 'g', 'litro', 'ml', 'pack', 'caja', 'metro'].map((unit) => (
                <option key={unit}>{unit}</option>
              ))}
            </select>
          </label>
          <label>
            Proveedor
            <select
              value={form.supplierId}
              onChange={(event) => setForm({ ...form, supplierId: event.target.value })}
            >
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="button" onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              Guardar producto
            </button>
          </div>
        </form>
      )}

      {bulkOpen && (
        <form className="bulk-panel" onSubmit={applyBulk}>
          <div>
            <h2>Actualizar precios</h2>
            <p>Revisá la vista previa antes de confirmar.</p>
          </div>
          <label>
            Alcance
            <select
              value={bulk.scope}
              onChange={(event) => setBulk({ ...bulk, scope: event.target.value })}
            >
              <option value="all">Todos los productos</option>
              <option value="category">Una categoría</option>
              <option value="selected">Productos seleccionados</option>
            </select>
          </label>
          {bulk.scope === 'category' && (
            <label>
              Categoría
              <select
                value={bulk.category}
                onChange={(event) => setBulk({ ...bulk, category: event.target.value })}
              >
                <option value="">Elegir</option>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Porcentaje
            <input
              required
              inputMode="decimal"
              value={bulk.percentage}
              onChange={(event) => setBulk({ ...bulk, percentage: event.target.value })}
              placeholder="Ej. 12"
            />
          </label>
          <label>
            Redondear hacia arriba
            <select
              value={bulk.rounding}
              onChange={(event) => setBulk({ ...bulk, rounding: event.target.value })}
            >
              <option value="0">Sin redondeo</option>
              <option value="10">Múltiplos de $10</option>
              <option value="50">Múltiplos de $50</option>
              <option value="100">Múltiplos de $100</option>
            </select>
          </label>
          <div className="bulk-preview">
            <strong>{affected.length} productos</strong>
            {affected.slice(0, 3).map((product) => (
              <span key={product.id}>
                {product.name}: {money.format(product.price)} a{' '}
                {money.format(adjustedPrice(product.price, bulk.percentage, bulk.rounding))}
              </span>
            ))}
          </div>
          <button className="primary" disabled={busy}>
            Aplicar cambios
          </button>
        </form>
      )}

      {error && (
        <div className="form-error owner-error" role="alert">
          {error}
        </div>
      )}
      <div className="inventory-list product-admin-list">
        {products.map((product) => (
          <div className="inventory-row" key={product.id}>
            {canEdit && bulk.scope === 'selected' ? (
              <input
                className="row-check"
                type="checkbox"
                aria-label={`Seleccionar ${product.name}`}
                checked={selected.includes(product.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, product.id]
                      : current.filter((id) => id !== product.id),
                  )
                }
              />
            ) : (
              <div className="mini-emoji" style={{ background: product.color }}>
                {product.emoji}
              </div>
            )}
            <strong>{product.name}</strong>
            <span>{product.category}</span>
            <b>
              {money.format(product.price)} / {product.unit}
            </b>
            <span className={product.stock <= product.min ? 'stock-pill warning' : 'stock-pill'}>
              {unitLabel(product.stock, product.unit)}
            </span>
            {canEdit && (
              <div className="row-actions">
                <button aria-label={`Editar ${product.name}`} onClick={() => edit(product)}>
                  <Edit3 size={16} />
                </button>
                <button
                  aria-label={`Dar de baja ${product.name}`}
                  onClick={() => onDelete(product)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
