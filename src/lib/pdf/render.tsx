import { renderToBuffer } from "@react-pdf/renderer"
import { OrderDocument, OrderDocumentMulti } from "./order-document"
import type { OrderPdfData } from "./order-data"
import { QuotationDocument } from "./quotation-document"
import type { QuotationPdfData } from "./quotation-data"
import { PeQuotationDocument } from "./pe-quotation-document"
import type { PeQuotationPdfData } from "./pe-quotation-data"

/**
 * S-4c-2(H2): 「組み立て(OrderDocument)」と「出力先」を分離するための生成層。
 * route はこの Buffer をレスポンスに載せるだけ。B-053(GCS) 時は同じ Buffer を保存に回す。
 */
export async function renderOrderPdfBuffer(data: OrderPdfData): Promise<Buffer> {
  return renderToBuffer(<OrderDocument data={data} />)
}

/**
 * B-086: 複数発注書を1PDFに縦積み（発注ごと改ページ・案B）。既存の単票版は変更しない。
 */
export async function renderOrderPdfBufferMulti(
  dataList: OrderPdfData[],
): Promise<Buffer> {
  return renderToBuffer(<OrderDocumentMulti dataList={dataList} />)
}

/** QE-1R 見積書 PDF（Part B）。route はこの Buffer をレスポンスに載せる。 */
export async function renderQuotationPdfBuffer(
  data: QuotationPdfData,
): Promise<Buffer> {
  return renderToBuffer(<QuotationDocument data={data} />)
}

/** B-085 量産見積 見積書 PDF。route はこの Buffer をレスポンスに載せる。 */
export async function renderPeQuotationPdfBuffer(
  data: PeQuotationPdfData,
): Promise<Buffer> {
  return renderToBuffer(<PeQuotationDocument data={data} />)
}
