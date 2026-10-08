/**
 * B-267: 縫製仕様書の Measurer。B-268 D-3 で帳票共通の loadPdfMeasurer（pdf-measure.ts）に移し、
 * ここは同じものを縫製仕様書の名前で再輸出するだけ（呼び出し側の結果は変わらない）
 */
export { loadPdfMeasurer as loadSewingSpecMeasurer } from "./pdf-measure"
