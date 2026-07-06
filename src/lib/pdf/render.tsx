import { renderToBuffer } from "@react-pdf/renderer"
import { OrderDocument } from "./order-document"
import type { OrderPdfData } from "./order-data"
import { QuotationDocument } from "./quotation-document"
import type { QuotationPdfData } from "./quotation-data"

/**
 * S-4c-2(H2): 「組み立て(OrderDocument)」と「出力先」を分離するための生成層。
 * route はこの Buffer をレスポンスに載せるだけ。B-053(GCS) 時は同じ Buffer を保存に回す。
 */
export async function renderOrderPdfBuffer(data: OrderPdfData): Promise<Buffer> {
  return renderToBuffer(<OrderDocument data={data} />)
}

/** QE-1R 見積書 PDF（Part B）。route はこの Buffer をレスポンスに載せる。 */
export async function renderQuotationPdfBuffer(
  data: QuotationPdfData,
): Promise<Buffer> {
  return renderToBuffer(<QuotationDocument data={data} />)
}
