import type { ComponentProps } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ColorwaySection } from "./colorway-section"
import { QuantityMatrixSection } from "./quantity-matrix-section"

/**
 * B: 「カラー展開」ボックスと「数量マトリクス（カラー×サイズ）」ボックスを
 * 1つの「カラー×数量（カラー×サイズ）」ボックスに統合するラッパー。
 *
 * - 既存 2 コンポーネントの状態管理・action 呼び出しはそのまま流用（機能の変更なし・置き場所の統合のみ）。
 * - ColorwaySection: カラーウェイの追加/編集/アーカイブ導線＋記号・カラー名・色チップ・調達色（マスター色名）・状態。
 * - QuantityMatrixSection(bare): SKU 生成＋色×サイズの数量マトリクス（受注/量産・色別計）。
 */
export function ColorQuantitySection({
  productId,
  colorways,
  colorOptions,
  patternOptions,
  skus,
  defaultSizeOptions,
  categoryId,
}: {
  productId: string
  colorways: ComponentProps<typeof ColorwaySection>["colorways"]
  colorOptions: ComponentProps<typeof ColorwaySection>["colorOptions"]
  patternOptions: ComponentProps<typeof ColorwaySection>["patternOptions"]
  skus: ComponentProps<typeof QuantityMatrixSection>["skus"]
  defaultSizeOptions: string[]
  categoryId: string | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">カラー×数量（カラー×サイズ）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">カラー展開</h4>
          <ColorwaySection
            productId={productId}
            colorways={colorways}
            colorOptions={colorOptions}
            patternOptions={patternOptions}
          />
        </div>
        <QuantityMatrixSection
          skus={skus}
          productId={productId}
          defaultSizeOptions={defaultSizeOptions}
          categoryId={categoryId}
          bare
        />
      </CardContent>
    </Card>
  )
}
