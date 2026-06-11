import { renderToBuffer } from "@react-pdf/renderer"
import { OrderDocument } from "./order-document"
import type { OrderPdfData } from "./order-data"

/**
 * S-4c-2(H2): 「組み立て(OrderDocument)」と「出力先」を分離するための生成層。
 * route はこの Buffer をレスポンスに載せるだけ。B-053(GCS) 時は同じ Buffer を保存に回す。
 */
export async function renderOrderPdfBuffer(data: OrderPdfData): Promise<Buffer> {
  return renderToBuffer(<OrderDocument data={data} />)
}
