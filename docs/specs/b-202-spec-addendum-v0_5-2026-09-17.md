# B-202 品番カルテ1画面化 仕様確認 addendum v0.5（PR-2 の方針確定）

- 識別子: SKETCH-BAND
- 日付: 2026-09-17（JST）
- 位置づけ: v1.0 / addendum v0.1〜v0.4 を補完する。食い違う場合は本書が上位。一次資料は引き続き v0.3 §0 のモック「品番カルテ 3案」案C
- 契機: 2026-09-17 のセッションで、慎太郎さんが絵型の形を判断し、PR-2 の読み取り専用の確認（Claude Code・main 85d2a16 時点）で caption の保存経路が無いことが判明したため

## 0. 本書で変わったこと（4行）

1. 絵型は全幅の帯で確定。v0.4 D-17 の「暫定」を外し、D-12 の3カラム（左＝絵型 216px）には戻さない
2. caption を書き込む action は存在しなかった。v0.2 D-10 と RECON-M §1-4 の「action 変更なし」は誤り。PR-2 で action と validator を新しく作る
3. 1画面の右カラムは数量表のみ。カラー展開の編集はボタンバーの新しいグループ「カラー展開（編集）」へ移す
4. 加工のチップ名は「加工：◯◯」

## 1. 確定事項

### D-21 絵型は全幅の帯で確定（v0.4 D-17 の暫定を解除）

- 慎太郎さんの判断（2026-09-17）: 「絵型は『帯』のまま」
- モック案C の minitabs（前 / 後 / 仕様図 / 写真）は採用しない。1画面は ヘッダ → 絵型の帯 → 2カラム → ボタンバー のまま
- BACKLOG B-202 の一行定義にある「絵型タブ」は本 D-21 で不採用（BACKLOG は追記で訂正する）
- sketch-section.tsx 166行目のコメント「PR-2 のタブ化までの暫定」は PR-2 で書き換える

### D-22 caption の保存経路を新設する（v0.2 D-10 / RECON-M §1-4 の訂正）

2026-09-17 の実測（Claude Code・read-only）:

    addProductSketch（product-sketches.ts 128-137行）: 配列の要素は { gcsPath, thumbGcsPath, sortOrder } のみ。caption を書かない
    reorderProductSketches: 既存の要素をそのまま並べ替える。caption があれば残るが、設定はできない
    caption を触る action の行: 284行 getProductSketchUrls（読み取り・署名URL化）だけ
    validators: sketch 系のファイルなし

- 誤りの経路: RECON-M は「280行が caption を保存経路に通している」と書いたが、それは読み取り側だった。型（ProductSketch.caption?: string）は存在する
- PR-2 で作るもの
  - validator `src/lib/validators/product-sketch.ts`（新規）: caption は trim・最大50文字・空文字は「caption なし」として扱う
  - action `updateProductSketchCaption(productId, gcsPath, caption)`（product-sketches.ts に追加）: requireSession → companyId で品番を読み直す → gcsPath で要素を特定（無ければエラー）→ caption を設定または削除 → product.update → AuditLog（addProductSketch と同じ形）→ revalidatePath（詳細と一覧）
  - UI: 帯の各サムネの下に caption を表示し、クリックでその場で編集する（Enter か フォーカスが外れたら保存・Esc で取り消し・変更が無ければ保存しない）。未設定のときは薄い字で「説明を追加」
- 表示先: サムネの下のラベル／拡大ダイアログの見出し／img の alt。空のときの既定は `絵型 {i+1}`（既存の文言のまま）
- caption の上限50文字は暫定値（慎太郎さんの確認待ちではなく、変更の申し出があれば直す）
- schema 変更・migration はゼロのまま（v0.2 D-9）

### D-23 1画面の右カラムは数量表のみ（v0.4 §4-1 の解消）

モック案C の原文（右カラム・文言ごと引用）:

    <h4>SKU 数量（色 × サイズ）</h4>
    <table class="mx"><thead><tr><th>色</th><th>1</th><th>2</th><th>3</th><th>4</th><th>計</th></tr></thead>
    ... <tfoot><tr><td>計</td> ...

- モックの右カラムには「色 × サイズ × 計」の表だけがあり、カラー展開の一覧・編集は無い
- モックでは色チップ（A ブラック / B オフ白）が絵型の下にあったが、D-21 で左カラムが無いため採用しない（色は数量表の行見出しで読める）
- 実装: 右カラムの ColorQuantitySection（56行・colorway-section 616行＋quantity-matrix-section 169行のラッパ）をやめ、QuantityMatrixSection だけを置く。見出しはモックの文言「SKU 数量（色 × サイズ）」
- カラー展開の編集（ColorwaySection）はボタンバーの新しいグループ「カラー展開（編集）」へ移す。v0.4 D-16「進行（編集）」と同じ扱い
- ボタンバーは7グループから8グループになる（v0.3 D-13 の数は例示であり上限ではない・v0.4 D-16）

### D-24 加工のチップ名（v0.4 §4-2 の解消）

- production-progress-chips.tsx 26行目 `processingTypeName ?? "加工"` を、`加工：{processingTypeName}`（名前が無ければ「加工」）にする
- モックに加工のチップは描かれていないため、モック由来ではなく慎太郎さんの改善希望（2026-09-15）に基づく

## 2. PR-2 以降の範囲

- PR-2: D-21（コメントの書き換えのみ）・D-22・D-23・D-24。schema 変更なし・revert 可
- PR-3（メモ＝Comment の配線）: 変更なし。★v0.2 §1-2 の「本番で comments の count を1回取る」受け入れ条件は、Comment を触る PR-3 に移す
- PR-4（表示スイッチ）: 変更なし

## 3. 教訓

- 「型がある」「読み取り経路にある」を「保存できる」と読んだ。保存の有無は、書き込む action 本体の中で配列要素を組み立てている行を読んで確かめる（file-write-verification 鉄則10-2 と同じ形）
- 覆した認識は、書いた場所（v0.2 D-10・RECON-M §1-4・v0.4 §3 PR-2 の 1）すべてに訂正注記を入れる

## 改訂履歴

- v0.5（2026-09-17, SKETCH-BAND）— D-21〜D-24。caption 保存経路の不在を訂正。本番 comments count の受け入れ条件を PR-3 へ移動
- v0.4（2026-09-16, PR1R-DONE）
- v0.3（2026-09-15, MOCK-C）
- v0.2（2026-09-15, RECON-M）
- v0.1（2026-09-13, QLOG-B202）
- v1.0（2026-09-12, RECON-L）

★このメモはここで終わり（END-OF-ADDENDUM-V05）
