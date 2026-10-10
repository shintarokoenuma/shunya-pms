# B-211 PR-2 実装ブリーフ — 発注明細の「海外発送」の印と、HS を決める質問（2026-10-10）

- 作成: 2026-10-10 claude.ai（慎太郎さん + Claude）
- 一次資料: claude/b-110-b-211-export-invoice-spec-confirmation-v1_0-2026-10-10.md（D-12・D-13・D-17・D-18・§3-2・§4 PR-2）
- 参考画面: https://claude.ai/artifact/GKxtp8vaLBehv1BTrf2PQ4 「HSコード判定 参考画面」の **案B（質問に答える）**。最初に案C（似た材料）を出す
- 前の PR: PR #196（squash 9b3ae95・2026-10-10 18:23 マージ・本番確認済み）。材料の exportSpec / referenceUrls、判定の純関数 src/lib/hs/classify.ts（classifyHs・missing を返す）、似た材料の action listHsReferenceMaterials、写しの純関数 src/lib/hs/copy-from-reference.ts、材料フォームの export-spec-section.tsx
- 慎太郎さん: 「続けましょう。」（2026-10-10 18:32）
- recon（RECON-B110-2・2026-10-10 10:06・dev 読み取り）:
  - PoItem に印を受ける列は無い（Boolean は isPhysicalAsset のみ）。PoItem.hsCode / originCountry は列はあるが、発注の validator（validators/purchase-order.ts poItemInputSchema :51-106）と action（purchase-orders.ts）は書いていない
  - PurchaseOrder.isInternational / hasTradeDocuments（ヘッダ・読むだけ・常に false）は休眠。行ごとの要件（D-13）に合わないので使わない
  - dev の po_items は 80 件・hs_code 0・origin_country 0
  - ★発注の編集は明細を消して作り直す方式（B-124）。新しい列は作り直しの経路にも必ず通す

## 1. この PR で作るもの

1. 発注明細の「海外発送」の印（PoItem.isForExport・ADD COLUMN 1 本）
2. 印の行の HS コード・原産国（PoItem.hsCode / originCountry を発注の画面から書けるようにする）
3. 印を付けた行の材料に HS が無いとき、その場で HS を決める質問（案B・最初に案C）。答えは材料マスターに保存（D-17）
4. 発注の詳細に、海外発送の行・HS・原産国と、HS が空の行の注意

作らないもの（§8）: 輸出インボイス（PR-4・PR-5）／自社の英文・国の英語名（PR-3）／作業発注（WO）の印／発注書 PDF への HS の印字

## 2. STEP 0 — 着手前の実測（想定と違えば止めて報告）

```
date
cd ~/shunya-production-system
git switch main && git pull origin main
git log --oneline -1            # 9b3ae95 か、それより新しい main
git status --porcelain          # 空
grep -o 'hopper[^/]*\|shuttle[^/]*' .env | head -1   # hopper.proxy.rlwy.net:12921

# ① 発注の明細の入力（行の部品・材料の選び方・作成と編集の両方）
ls "src/app/(app)/purchase-orders/" "src/app/(app)/purchase-orders/_components/"
grep -n -E 'materialId|isPhysicalAsset|unitPrice|useFieldArray|append\(' "src/app/(app)/purchase-orders/_components/"*.tsx | head -40
# ② validator と action の明細の組み立て（create / update・明細の作り直し）
sed -n 40,135p src/lib/validators/purchase-order.ts
grep -n -E 'poItem|items\.(map|create)|createMany|deleteMany|isPhysicalAsset' src/lib/actions/purchase-orders.ts | head -40
# ③ 明細を作るほかの経路（量産発注の生成・複製など）— isForExport を false で作ることを確かめるため
grep -rn -E 'poItem\.(create|createMany)|items: \{ *create' src/lib/actions/ | head -20
# ④ 発注の詳細の明細表
grep -n -E 'isPhysicalAsset|<TableHead|unitPrice' "src/app/(app)/purchase-orders/[id]/page.tsx" | head -20
# ⑤ 材料の編集権限の判定（質問の答えを材料に保存してよいか）
grep -n -E 'checkArea|requireArea|masterTerms' src/lib/actions/materials.ts | head -10
# ⑥ LINT BEFORE
npx eslint . -f json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('BEFORE errors',sum(f['errorCount'] for f in d),'warnings',sum(f['warningCount'] for f in d))"
```

## 3. 決めたこと

### P2-D1 器（schema・ADD COLUMN 1 本だけ）

```prisma
model PoItem {
  // …既存…
  /// B-211 PR-2 / B-110 D-12・D-13: 海外発送（輸出インボイスに載せる行）の印
  isForExport Boolean @default(false) @map("is_for_export")
}
```

- 既存の行は false で埋まる（DEFAULT 付きの NOT NULL・既存行に影響なし）
- hsCode / originCountry は既存の列を使う（schema は変えない）

### P2-D2 発注の明細の入力

- 行に「海外発送」のチェック（狭い幅では行の下段に）。既定はオフ
- チェックを付けた行だけ、HS コード（文字・20 字まで）と原産国（COUNTRY_OPTIONS の Select）の欄を出す
- 値の入り方:
  - 行の材料（materialId）があり、材料に HS があれば、チェックを付けた時に材料の hsCode / originCountry を行に写す（行で直せる）
  - 材料に HS が無ければ、行に「HS を決める」ボタンを出す（P2-D3）。材料が無い行（手入力の品名）は HS・原産国を手で入れる
  - チェックを外したら行の HS・原産国は保存しない（null にする）
- 保存は HS が空でも止めない（止めるのは輸出インボイスの出力・D-4）。HS が空の印の行は黄色の注意「HS コードが未入力（輸出インボイスに載せられません）」
- validator: poItemInputSchema に isForExport（boolean・既定 false）・hsCode（optional・20 字）・originCountry（optional・isValidCountry）。isForExport が false なら hsCode / originCountry は捨てる
- action: create と update（明細の作り直しを含む）の data 組み立て行に isForExport・hsCode・originCountry を通す。★「保存できる」は data の組み立て行に 3 列が現れることで確かめる
- ③で見つかった他の経路（量産発注の生成など）は isForExport を書かない（既定の false）

### P2-D3 HS を決める質問（案B・最初に案C）

- 行の「HS を決める」でダイアログを開く。中身は上から:
  1. 似た材料（listHsReferenceMaterials・案C）。「写す」で規格・HS・（空なら）混率を写す（buildCopyFromReference をそのまま使う）
  2. 質問（1 問ずつ）。classifyHs の missing の先頭の項目を聞き、答えるたびに判定し直す。聞き方:
     - composition（混率）: 繊維の Select ＋ % の行（材料フォームの混率の部品を流用）
     - fabricWeight（目付）・fabricWidth（幅）: 数値の入力
     - exportSpec の各項目: 選択肢のボタン（export-spec.ts のラベル）
  3. 右に候補（番号・説明・根拠の文・「要確認」・candidateNote）。code が出たら「この HS で確定」。最後まで code が出なければ「手で入力」
- 質問の順番を決める純関数 `nextHsQuestion(result: HsResult): keyof … | null`（src/lib/hs/questions.ts）。missing の先頭を返し、無ければ null。テストを付ける
- 「確定」で行うこと（1 つの action `decideMaterialHs`）:
  - 材料に保存: compositionData・exportSpec（hsSource は CANDIDATE か COPIED か MANUAL・decidedAt・decidedByUserId）・hsCode・fabricWeight / fabricWidth（質問で入れたときだけ）・originCountry（空のときだけ発注の行の値を入れる）。AuditLog UPDATE（before / after に変えた列）
  - ★材料を編集できない役割（STEP 0 ⑤の判定で拒否される人）なら、材料には保存せず、行の HS にだけ入れる。その旨をダイアログに出す（「材料マスターを編集できないため、この発注の行にだけ入れました」）
  - 行の hsCode に確定した番号を入れる（発注の保存はフォームの「保存」で行う。ダイアログはフォームの値を書き換えるだけ）
- 同じ材料の行が発注に複数あれば、確定した HS を同じ材料の印の行すべてに入れる

### P2-D4 発注の詳細

- 明細表に「海外発送」の列（印の行に札）・HS コード・原産国。印の行で HS が空なら黄色の注意
- 明細表の上に要約「海外発送 n 行（HS 未入力 m 行）」（印の行がある発注だけ）

### P2-D5 migration（shunya-environment-safety-check ルール 00）

1. host が hopper.proxy.rlwy.net:12921（dev）であることを確認
2. `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` の出力が `ALTER TABLE "po_items" ADD COLUMN "is_for_export" BOOLEAN NOT NULL DEFAULT false;` だけであること。それ以外が 1 行でも出たら止めて報告
3. `npx prisma db push`（--accept-data-loss は付けない）
4. `prisma/migrations/20261010100000_b211_pr2_po_item_for_export/migration.sql` を手書き（冒頭に意図と非破壊のコメント）。2 と一致すること
5. dev サーバは慎太郎さんが起動し直す（★build の前に 3001 を止めるときは、止めたことを報告に書く。PR-1 FIX-1 では動いている dev サーバのまま build と .next 削除をしてしまった）
- ★`prisma migrate dev` / `migrate reset` / `--accept-data-loss` は使わない

### P2-D6 置き場所（案）

- `src/lib/hs/questions.ts`（nextHsQuestion）・`src/lib/hs/questions.test.ts`
- `src/lib/actions/materials.ts` に decideMaterialHs（または `src/lib/actions/material-hs.ts`）
- `src/app/(app)/purchase-orders/_components/` に hs-decide-dialog.tsx と、明細行の印・HS・原産国の欄
- 材料フォームの混率の行の部品は、export-spec-section.tsx から切り出して両方で使う（重複して書かない）

## 4. テスト（npx tsx・既存と同じ assert 方式）

- nextHsQuestion: 素材タイプだけの生地 → fabricForm（または composition）を返す／綿 100%・織物・綾織・浸染・目付なし → fabricWeight／全部そろう → null／ファスナーで素材なし → trimMaterial／袋 → null（手入力）
- 質問に順に答えると 5208.33 に着く（SY8300624 の生地の例）
- 既存のテスト（classify 16 groups ほか）がすべて通る

## 5. dev の確認（localhost:3001）

dev サーバは本 PR のブランチに git switch し、db push の後に起動し直す。dev の材料は MT-004（HS 5309.19 あり）・MT-005（HS あり）と、HS の無い材料が残り 12 件。

1. 既存の発注を編集し、MT-004 の行に「海外発送」→ HS 5309.19・原産国 日本 が自動で入る → 保存 → 詳細に「海外発送」の札・HS・原産国、上に「海外発送 1 行（HS 未入力 0 行）」
2. HS の無い材料の行に「海外発送」→「HS を決める」→ 似た材料を写すか質問に答えて確定 → 行に HS が入る → 保存。材料の詳細を開くと HS・規格が入っている（「候補から」か「〇〇から写した」）
3. 手入力の品名の行（材料なし）に「海外発送」→ HS を手で入れて保存できる
4. HS を空のまま「海外発送」だけ付けて保存できる → 詳細に黄色の注意と「HS 未入力 1 行」
5. 「海外発送」を外して保存 → 行の HS・原産国が消える（詳細で確認）
6. 印を付けない発注が今までどおり作成・編集できる（既存の行は「海外発送」なし）
7. read-only SQL で po_items の is_for_export / hs_code / origin_country が 1〜5 の操作どおりになっていること（列名は schema の @map から）

## 6. 本番への影響

- マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）。migration は po_items に DEFAULT false の列 1 本だけ（既存の発注の行はすべて「海外発送」なし）
- 本番で印を付けるのは慎太郎さんが運用を始めるとき。PR の確認で本番の発注を編集しない

## 7. 作業の約束

- ブランチ feat/b211-pr2-po-item-export（STEP 0 の main から）。PR 必須
- ゲート: npx tsc --noEmit・触ったファイルの eslint・全体の lint error 合計が BEFORE から増えていない・テスト全部・npx next build（★3001 を止めてから。止めたら報告に書く。終わったら .next を消す）
- 通れば commit → push → PR open まで。マージは慎太郎さん
- PR 本文に: STEP 0 の実測（明細の入力の部品・明細の作り直しの経路・他の作成経路）／migrate diff と手書き migration の一致／§5 の手順／LINT の BEFORE と AFTER

## 8. この PR で作らないもの

- 輸出インボイス（PR-4）・Excel／PDF（PR-5）・自社の英文と国の英語名（PR-3）
- 作業発注（WO）の印（材料を送るのは PO の明細。WO が要るとなったら別に起票）
- 発注書 PDF に HS・海外発送を印字すること
- 量産発注の生成で「海外発送」を自動で付けること（送り先の工場の国から判断する案は、輸出インボイスを作った後に要否を決める）
- 判定の木の澁澤WT との照合（verified は false のまま）
- 品質表示の繊維名 27 種へのそろえ（次回チャット・B-020）

END-OF-BRIEF-B211-PR2
