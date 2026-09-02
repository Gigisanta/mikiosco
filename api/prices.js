import { requireRole } from './_lib/auth.js'
import { dbTransaction } from './_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from './_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN'])
  if (!user) return
  if (request.method !== 'PATCH') return methodNotAllowed(response, ['PATCH'])
  const percentage = Number(request.body?.percentage)
  const rounding = Number(request.body?.rounding || 0)
  const scope = request.body?.scope || 'all'
  const selectedIds = Array.isArray(request.body?.productIds) ? request.body.productIds : []
  if (!Number.isFinite(percentage) || percentage <= -100 || percentage > 1000) {
    return json(response, 422, { error: 'Ingresá un porcentaje entre -99,99% y 1000%.' })
  }
  if (![0, 1, 10, 50, 100].includes(rounding)) {
    return json(response, 422, { error: 'El redondeo elegido no es válido.' })
  }
  const updated = await dbTransaction(async (client) => {
    const values = [user.branchId]
    let filter = ''
    if (scope === 'category') {
      values.push(request.body.categoryId)
      filter = ` AND category_id=$${values.length}`
    } else if (scope === 'supplier') {
      values.push(request.body.supplierId)
      filter = ` AND supplier_id=$${values.length}`
    } else if (scope === 'selected') {
      if (!selectedIds.length) {
        throw Object.assign(new Error('Seleccioná al menos un producto.'), { statusCode: 422 })
      }
      values.push(selectedIds)
      filter = ` AND id=ANY($${values.length}::uuid[])`
    } else if (scope !== 'all') {
      throw Object.assign(new Error('El alcance elegido no es válido.'), { statusCode: 422 })
    }
    values.push(1 + percentage / 100, rounding)
    const factorIndex = values.length - 1
    const roundingIndex = values.length
    const result = await client.query(
      `UPDATE products SET sale_price=CASE WHEN $${roundingIndex}::numeric > 0
        THEN CEIL((sale_price*$${factorIndex})/$${roundingIndex})*$${roundingIndex}
        ELSE ROUND(sale_price*$${factorIndex},2) END
       WHERE branch_id=$1 AND active=true${filter}
       RETURNING id,sale_price AS "salePrice"`,
      values,
    )
    return result.rows
  })
  return json(response, 200, { items: updated, count: updated.length })
}

export default withErrorHandling(handler)
