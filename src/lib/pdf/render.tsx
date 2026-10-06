import { renderToBuffer } from "@react-pdf/renderer"
import { OrderDocument, OrderDocumentMulti } from "./order-document"
import type { OrderPdfData } from "./order-data"
import { QuotationDocument } from "./quotation-document"
import type { QuotationPdfData } from "./quotation-data"
import { PeQuotationDocument } from "./pe-quotation-document"
import type { PeQuotationPdfData } from "./pe-quotation-data"
import { SewingSpecDocument } from "./sewing-spec-document"
import type { SewingSpecPdfData } from "./sewing-spec-data"
import { planInputFromData, planSewingPages, type SewingSpecPlan } from "./sewing-spec-layout"
import { loadSewingSpecMeasurer } from "./sewing-spec-measure"
import { InvoiceDocument } from "./invoice-document"
import type { InvoicePdfData } from "./invoice-data"
import { DeliveryNoteDocument } from "./delivery-note-document"
import type { DeliveryNotePdfData } from "./delivery-note-data"

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

/** B-109 PR-4 請求書 PDF（複数を縦積み・1件でも配列で受ける）。 */
export async function renderInvoicePdfBuffer(dataList: InvoicePdfData[]): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument dataList={dataList} />)
}

/** B-109 PR-4 納品書 PDF（複数を縦積み・1件でも配列で受ける）。 */
export async function renderDeliveryNotePdfBuffer(dataList: DeliveryNotePdfData[]): Promise<Buffer> {
  return renderToBuffer(<DeliveryNoteDocument dataList={dataList} />)
}

/** B-267: 縫製仕様書のページの計画（描画と同じフォントで行数を数える）。試し刷りで出力のページ数と突き合わせる */
export async function planSewingSpecPdf(data: SewingSpecPdfData): Promise<SewingSpecPlan> {
  const measurer = await loadSewingSpecMeasurer()
  return planSewingPages(planInputFromData(data), measurer)
}

/** B-054 PR-4a 縫製仕様書 PDF。route はこの Buffer をレスポンスに載せる。B-267: 先にページの計画を立ててから描く */
export async function renderSewingSpecPdfBuffer(
  data: SewingSpecPdfData,
  plan?: SewingSpecPlan,
): Promise<Buffer> {
  const resolved = plan ?? (await planSewingSpecPdf(data))
  return renderToBuffer(<SewingSpecDocument data={data} plan={resolved} />)
}
