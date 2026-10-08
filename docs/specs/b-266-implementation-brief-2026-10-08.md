# B-266 実装ブリーフ — 発注書 PDF にデザイン番号（D/#）とカラーウェイ名を出す（2026-10-08）

- 作成: 2026-10-08 claude.ai（慎太郎さん + Claude）
- 決定: 慎太郎さん 2026-10-08 12:51「Aで行きましょう。」
- 一次資料: 参考紙面（Artifact「発注書 D/# 列の案」案A）・docs/specs/s-4c-2-order-pdf-spec-confirmation-v1_0-2026-06-11.md（H3「v1.0 は最小で出し、実物を見ながら追補で調整」）・docs/specs/s-4b-1-purchase-order-spec-addendum-v1_1-2026-06-08.md（実発注例の D/#A・DHL）・docs/specs/b-066-textile-pattern-master-spec-confirmation-v1_1-2026-06-17.md:36（色の実指定は発注書側＝先方デザイン番号）
- ライフサイクル: 8（量産発注）・4（サンプル）
- recon（2026-10-08 11:25・main f8ced48・dev hopper:12921・読み取りのみ）の要点:
  - PDF の明細型 OrderPdfItem（src/lib/pdf/order-data.ts:11-19）に designCode もカラーウェイも無い。PO の poItem.findMany は全列を取っているが、:161-172 で詰めていない
  - 発注書と作業発注書は同じ部品（order-document.tsx・render.tsx）。WoItem に designCode 列は無い
  - 発注の詳細画面の「カラー」は cw ? `${name}（${code}）` : formatColorCode(colorCode)（purchase-orders/[id]/page.tsx:236-238）
  - dev po_items: design_code あり3行（D-1・「D-1 」・DJ）／color_code 無しでカラーウェイ有り 35行（PDF の C# は全部「—」）／color_code 有りでカラーウェイ無し 10行／両方有り 0行
  - 画面・PDF の「D#」は柄マスターの柄番号（TextilePattern.patternNumber）。発注・BOM の designCode とつながるコードは無い（別物）

## 1. 決めたこと

- D-1（案A）: 品番の欄に2段で出す。1段目＝今の品番（仕入先品番、無ければ素材コード）、2段目＝デザイン番号を小さく薄く「D/# D-1」。列数も列幅も変えない（品名 24・品番 15・C# 15・数量 11・単位 9・単価 13・金額 13）
  - 品番が無くデザイン番号だけの行は、デザイン番号を1段目に普通の大きさで出す（参考紙面の文言「仕入先品番が無く D/# だけの行は D/# が1段目に来る」）
  - どちらも無い行は今と同じ「—」
  - 見出しは発注書（PO）だけ「品番 / D/#」。作業発注書（WO）はデザイン番号を持たないので「品番」のまま
- D-2（デザイン番号の出し方・B-249 の最小）: 前後の空白を取る。頭がすでに「D/#」「D#」（大文字小文字・間の空白を問わない）で始まっていればそのまま出し、それ以外は頭に「D/# 」を付ける。保存の仕組み・保存済みの値は変えない（頭の付け方の本決めは B-249 に残す）
- D-3（カラー）: C# の欄 = 色番（formatColorCode(colorCode)）→ 無ければカラーウェイ名 → 無ければ「—」
  - カラーウェイ名は名前だけを出す（参考紙面は「BLACK」。画面の「BLACK（A）」の（A）は社内のコードなので付けない）
  - 色番とカラーウェイの両方がある行は色番を優先する（発注先が使う番号のため）。画面はカラーウェイを優先しており逆になる。dev に両方ある行は0行
  - カラーウェイ名の取得は画面と同じく productColorway を companyId で絞って引く（purchase-orders/[id]/page.tsx:60-77 と同じ形）

## 2. 変更するファイル

1. src/lib/design-code.ts（新規）: `formatDesignCode(v: string | null | undefined): string | null`（D-2）
2. 上の純関数のテスト（新規）: 既存の PDF テスト（invoice-rows.test.ts など）と同じ置き場所・同じ書き方（npx tsx で実行）。最低限のケース: null→null／"  "→null／"D-1"→"D/# D-1"／"D-1 "→"D/# D-1"／"DJ"→"D/# DJ"／"D/#A"→"D/#A"／"d# 12"→"d# 12"／"DHL"→"D/# DHL"
3. src/lib/pdf/order-data.ts:
   - OrderPdfItem に `designCode: string | null`（表示用に整えた後の値）と `colorwayName: string | null` を足す
   - PO: designCode = formatDesignCode(it.designCode)。productColorwayId を集めて productColorway.findMany（where: id in・companyId、select: id・colorwayName）→ colorwayName
   - WO: designCode = null・colorwayName = null
4. src/lib/pdf/order-document.tsx:
   - 品番セルを D-1 の2段に（2段目のスタイルは小さめ・薄い色。既存の styles にあれば流用、無ければ足す）
   - 見出しを docKind で出し分け（PO「品番 / D/#」・WO「品番」）
   - C# セルを D-3 に
5. 本書を docs/specs/b-266-implementation-brief-2026-10-08.md として同梱

画面（発注の詳細・編集）・保存（validator・action）・schema は触らない。migration なし。

## 3. 確認（dev・localhost:3001）

dev サーバは本 PR のブランチに git switch してから起動し直す。

1. PO-2026-0026 の PDF: 明細2「てすて」の品番欄が「10000」の下に小さく「D/# D-1」。C# は「C/#D300」のまま。見出しが「品番 / D/#」
2. PO-2026-0010 の PDF: デニム3行の C# が BLACK・WHITE・BLACKx WHITE ボーダー（どの行がどの色かは画面の明細と同じ順）。品番欄は「—」のまま
3. 長い値: DRAFT の PO-2026-0026 の明細2のデザイン番号を一時的に「BORDER-2026-SPRING-01」にして PDF を出し、2段目が品番の欄の中で折り返して隣の列に重ならないことを見る。見たら「D-1」に戻す（notes には触らない）
4. 作業発注書（WO）の PDF を1枚: 見出しが「品番」のまま、見た目が今と同じ
5. PDF の埋め込みフォントが2つ（Regular と Bold）のまま（shunya-pdf-document §7）

## 4. 本番への影響

- マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）。発注書 PDF の品番欄と C# 欄の中身が増える。作業発注書・ほかの帳票は変わらない
- データは変わらない。migration なし

## 5. 作業の約束

- ブランチ feat/b266-po-pdf-design-code（main f8ced48 から）。PR 必須
- 着手前に repo 全体の lint error 合計を測って控える
- npx tsc --noEmit・触ったファイルの eslint・全体の lint error 合計が着手前から増えていないこと・新しいテストと既存の PDF テスト（invoice-rows・sewing-spec-format・pe-quotation-data）・npx next build（dev サーバ 3001 を止めて実行し、終わったら .next を消す。dev の起動し直しは慎太郎さん）が通れば commit → push → PR open まで。マージは慎太郎さん

## 6. 本 PR で作らないもの

- 品番・数字のかたまりを途中で折らない指定（B-268・次の PR）
- デザイン番号の保存時に頭を取る仕組みと、頭の付け方の本決め（B-249）
- 発注の詳細画面のカラーの優先順（画面はカラーウェイ優先のまま）
- 量産発注の生成で、色別の行に BOM の仕入色番（BomItemColorway.supplierColorCode）を入れること（必要なら別番号で起票）

END-OF-BRIEF-B266
