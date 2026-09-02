import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Upload,
  Save,
} from 'lucide-react'
import { Metric } from '../components/Metric'
import { money } from '../lib/format'
import { marginPercent, stockStatus, unitStep } from '../lib/inventory'

export function StockView({
  products,
  updateProduct,
  onSave,
  onImport,
  onExport,
  canEdit,
  importErrors = [],
}) {
  const [dirty, setDirty] = useState([])
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)
  const [sort, setSort] = useState({ field: 'name', direction: 1 })
  const low = products.filter((product) => product.stock <= product.min)
  const inventoryCost = products.reduce((sum, product) => sum + product.cost * product.stock, 0)
  const potentialMargin = products.reduce(
    (sum, product) => sum + (product.price - product.cost) * product.stock,
    0,
  )
  const visibleProducts = useMemo(() => {
    const filtered = onlyLow
      ? products.filter((product) => ['low', 'critical'].includes(stockStatus(product).level))
      : products
    return [...filtered].sort((left, right) => {
      const getValue = (product) =>
        sort.field === 'margin' ? marginPercent(product) : product[sort.field]
      return (
        String(getValue(left) ?? '').localeCompare(String(getValue(right) ?? ''), 'es', {
          numeric: true,
          sensitivity: 'base',
        }) * sort.direction
      )
    })
  }, [onlyLow, products, sort])

  function changeSort(field) {
    setSort((current) => ({
      field,
      direction: current.field === field ? current.direction * -1 : 1,
    }))
  }

  const header = (label, field) => (
    <button className="sort-button" onClick={() => changeSort(field)}>
      {label} {sort.field === field ? (sort.direction > 0 ? '↑' : '↓') : ''}
    </button>
  )

  return (
    <section className="management stock-page">
      <div className="manage-header stock-header">
        <p>Actualizá el inventario desde Excel y controlá rentabilidad y reposición.</p>
        <div className="header-actions">
          <button
            className={onlyLow ? 'secondary-action filter-active' : 'secondary-action'}
            onClick={() => setOnlyLow((value) => !value)}
          >
            <AlertTriangle size={17} /> Solo para reponer
          </button>
          <a className="secondary-action" href="/plantilla-stock-mikiosco.xlsx" download>
            <FileSpreadsheet size={18} /> Plantilla
          </a>
          <button className="secondary-action" onClick={onImport} disabled={!canEdit}>
            <Upload size={18} /> Importar Excel
          </button>
          <button className="primary" onClick={onExport}>
            <Download size={18} /> Exportar stock
          </button>
        </div>
      </div>
      <div className="stock-kpis">
        <Metric
          icon={<AlertTriangle />}
          label="Para reponer"
          value={String(low.length)}
          detail="En mínimo o por debajo"
          warning
        />
        <Metric
          icon={<CircleDollarSign />}
          label="Stock valorizado"
          value={money.format(inventoryCost)}
          detail="A precio de costo"
        />
        <Metric
          icon={<TrendingUp />}
          label="Margen potencial"
          value={money.format(potentialMargin)}
          detail="Si se vende el stock actual"
        />
      </div>
      <div className="stock-table-wrap">
        <table className="stock-table">
          <thead>
            <tr>
              <th>{header('Producto', 'name')}</th>
              <th>Medida</th>
              <th>{header('Actual', 'stock')}</th>
              <th>{header('Mínimo', 'min')}</th>
              <th>{header('Máximo', 'max')}</th>
              <th>{header('Costo', 'cost')}</th>
              <th>{header('Venta', 'price')}</th>
              <th>{header('Margen', 'margin')}</th>
              <th>Estado</th>
              {canEdit && <th>Acción</th>}
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((product) => {
              const status = stockStatus(product)
              return (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    <small>
                      {product.category}
                      <br />
                      {product.barcode}
                    </small>
                  </td>
                  <td>{product.unit}</td>
                  {['stock', 'min', 'max'].map((field) => (
                    <td key={field}>
                      <input
                        aria-label={`${field === 'stock' ? 'Stock actual' : field === 'min' ? 'Stock mínimo' : 'Stock máximo'} de ${product.name}`}
                        inputMode="decimal"
                        type="number"
                        step={unitStep(product.unit)}
                        min="0"
                        value={product[field]}
                        disabled={!canEdit}
                        onChange={(event) =>
                          (() => {
                            updateProduct(product.id, {
                              [field]: Math.max(0, Number(event.target.value)),
                            })
                            setDirty((current) =>
                              current.includes(product.id) ? current : [...current, product.id],
                            )
                          })()
                        }
                      />
                    </td>
                  ))}
                  <td>{money.format(product.cost)}</td>
                  <td>{money.format(product.price)}</td>
                  <td>
                    <strong>{(marginPercent(product) * 100).toFixed(1)}%</strong>
                    <small>
                      {money.format(product.price - product.cost)} / {product.unit}
                    </small>
                  </td>
                  <td>
                    <span
                      className={
                        status.level === 'ok' ? 'normal-status' : `status-badge ${status.level}`
                      }
                    >
                      {status.level === 'ok' ? 'Normal' : status.label}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <button
                        className="table-save"
                        disabled={!dirty.includes(product.id) || saving === product.id}
                        onClick={async () => {
                          setSaving(product.id)
                          try {
                            setError('')
                            await onSave(product)
                            setDirty((current) => current.filter((id) => id !== product.id))
                          } catch (requestError) {
                            setError(requestError.message)
                          } finally {
                            setSaving(null)
                          }
                        }}
                      >
                        <Save size={15} /> {saving === product.id ? 'Guardando' : 'Guardar'}
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
            {!visibleProducts.length && (
              <tr>
                <td colSpan={canEdit ? 10 : 9} className="empty-table-cell">
                  No hay productos que necesiten reposición.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && (
        <div className="form-error owner-error" role="alert">
          {error}
        </div>
      )}
      {importErrors.length > 0 && (
        <details className="import-issues" open>
          <summary>{importErrors.length} filas del último Excel necesitan revisión</summary>
          <ul>
            {importErrors.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="table-note">
        Las cantidades admiten decimales para kg, litros y metros. El máximo en 0 significa sin
        tope.
      </p>
    </section>
  )
}
