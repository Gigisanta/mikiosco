import {
  AlertTriangle,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { Metric } from '../components/Metric'
import { money } from '../lib/format'
import { marginPercent, stockStatus, unitStep } from '../lib/inventory'

export function StockView({ products, updateProduct, onImport, onExport }) {
  const low = products.filter((product) => product.stock <= product.min)
  const inventoryCost = products.reduce((sum, product) => sum + product.cost * product.stock, 0)
  const potentialMargin = products.reduce(
    (sum, product) => sum + (product.price - product.cost) * product.stock,
    0,
  )

  return (
    <section className="management stock-page">
      <div className="manage-header stock-header">
        <p>Actualizá el inventario desde Excel y controlá rentabilidad y reposición.</p>
        <div className="header-actions">
          <a className="secondary-action" href="/plantilla-stock-mikiosco.xlsx" download>
            <FileSpreadsheet size={18} /> Plantilla
          </a>
          <button className="secondary-action" onClick={onImport}>
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
              <th>Producto</th>
              <th>Medida</th>
              <th>Actual</th>
              <th>Mínimo</th>
              <th>Máximo</th>
              <th>Costo</th>
              <th>Venta</th>
              <th>Margen</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
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
                        onChange={(event) =>
                          updateProduct(product.id, {
                            [field]: Math.max(0, Number(event.target.value)),
                          })
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
                    <span className={`status-badge ${status.level}`}>{status.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        Las cantidades admiten decimales para kg, litros y metros. El máximo en 0 significa sin
        tope.
      </p>
    </section>
  )
}
