# B-211 PR-1 実装ブリーフ — 材料の「輸出用の規格」と HS コードの判定（2026-10-10）

- 作成: 2026-10-10 claude.ai（慎太郎さん + Claude）
- 一次資料: claude/b-110-b-211-export-invoice-spec-confirmation-v1_0-2026-10-10.md（D-10・D-16〜D-18・§2・§3-1・§4 PR-1）
- 参考画面: https://claude.ai/artifact/GKxtp8vaLBehv1BTrf2PQ4 「HSコード判定 参考画面」（案A・案C を PR-1 で作る。案B は PR-2）
- 慎太郎さん: 「概ね良さそうなので進めましょう。」（2026-10-10 10:20・v1.0 に対して）
- recon: RECON-B110（08:21）・RECON-B110-2（10:06）。main 8fd4304・dev hopper:12921・読み取りのみ
  - Material.hsCode / originCountry は入力・保存済み（validators/material.ts:148-149・materials.ts createMaterial :393-394 / updateMaterial :519-520・AuditLog :560-561/:591-592・material-form.tsx:641/661・materials/[id]/page.tsx:341-356・[id]/edit/page.tsx:75-76）
  - Material.compositionData（Json）は入力欄なし・dev 0 件。materialType は enum 15 値（FABRIC/LINING/INTERLINING/ZIPPER/BUTTON/THREAD/ELASTIC/TAPE/LABEL/HANG_TAG/CARE_LABEL/PACKAGING_BAG/POLYBAG/BOX/OTHER）
  - SharedFile（attachedToType / attachedToId の多態）は休眠・src 0。DDL 適用済みかは未実測（STEP 0 で測る）
  - B-125 の URL 列は schema に無い。HsCode マスター（全社共有）は dev 5 件
  - migration: dev は _prisma_migrations が無い既知の状態（migrate diff → db push → 手書き migration.sql）

## 1. この PR で作るもの

1. 材料に「輸出用の規格」を持たせる（混率の構造・規格・メーカーの URL）
2. HS の判定の純関数（規格から候補・根拠・足りない質問を返す）とテスト
3. 材料の作成・編集フォームに「輸出用の規格」の区画（案A）と「似た材料から写す」（案C）
4. 材料の詳細に、規格の要約・HS（要確認の印）・根拠ファイル（規格書 PDF・メールなど）・メーカー URL

作らないもの（§8）: 発注明細の「海外発送」の印と質問（案B）＝PR-2／輸出インボイス＝PR-4・PR-5／HsCode マスターへの番号の追加（B-017）

## 2. STEP 0 — 着手前の実測（想定と違えば止めて報告）

```
date
cd ~/shunya-production-system
git switch main && git pull origin main
git log --oneline -1            # 先頭の1行をそのまま報告
git status --porcelain          # 空であること
grep -o 'hopper[^/]*\|shuttle[^/]*' .env | head -1   # hopper.proxy.rlwy.net:12921（dev）であること

# ① SharedFile の全文と DDL（根拠ファイルの器に使えるか）
awk '/^model SharedFile \{/,/^\}/' prisma/schema.prisma
T=$(awk '/^model SharedFile \{/,/^\}/' prisma/schema.prisma | grep '@@map' | sed -E 's/.*@@map\("([^"]+)"\).*/\1/'); echo "map=$T"
grep -rln "CREATE TABLE \"$T\"" prisma/migrations/ | head -3     # 適用済みならヒットする
# 使えない場合（DDL 未適用・必須列が多態に合わない・companyId が無い 等）は止めて報告。新しい表は作らない

# ② ファイルを GCS に上げる既存の手本
grep -n -E '^export (async )?function|uploadTo|bucket|signedUrl' src/lib/gcs.ts | head -20
grep -n -E '^export (async )?function|File|formData|size|type' src/lib/actions/product-sketches.ts | head -30

# ③ 材料フォームの区画の並び（どこに「輸出用の規格」を挟むか）
grep -n -E '<(Card|CardTitle|h2|h3|section|fieldset)|FormLabel|label=' "src/app/(app)/materials/_components/material-form.tsx" | head -60
grep -n -E 'hsCode|originCountry|composition|fabricWeight|fabricWidth|materialType' src/lib/validators/material.ts src/lib/actions/materials.ts | head -40

# ④ 詳細ページの節
grep -n -E '<(Card|CardTitle|h2|h3|section)' "src/app/(app)/materials/[id]/page.tsx" | head -40

# ⑤ テストの流儀と既存テスト
ls src/lib/**/*.test.ts 2>/dev/null | head; grep -rln 'node:assert' src/lib | head -5

# ⑥ 着手前の lint error 合計（BEFORE）
npx eslint . 2>&1 | tail -3
```

## 3. 決めたこと

### P1-D1 器（schema・ADD COLUMN 2 本だけ）

```prisma
model Material {
  // …既存…
  /// B-211: 輸出用の規格（HS の判定に使う）。形は src/lib/hs/export-spec.ts の ExportSpec（version 1）
  exportSpec    Json?  @map("export_spec")
  /// B-211 / B-125: メーカーサイトなどの参考 URL [{ label, url }]
  referenceUrls Json?  @map("reference_urls")
}
```

- 混率は既存の `compositionData`（Json）に `[{ fiber, percent }]` で持つ（P1-D2）。組織・染めは `exportSpec` に入れ、`compositionData` に混ぜない
- 根拠ファイルは SharedFile（attachedToType = "Material"・attachedToId = material.id）。STEP 0 ① で使えると確かめた場合だけ。schema は変えない
- ★既存の `composition`（文字）はそのまま残す（帳票の補足行・既存画面で使っている）。compositionData から文字を作って上書きはしない（§8）

### P1-D2 型（src/lib/hs/export-spec.ts・zod と TypeScript 型）

```ts
// 混率（Material.compositionData）
type Fiber =
  | "COTTON" | "LINEN" | "RAMIE" | "WOOL" | "SILK"
  | "POLYESTER" | "NYLON" | "ACRYLIC" | "POLYURETHANE"   // 合成繊維（ポリウレタン＝弾性糸）
  | "RAYON" | "CUPRO" | "ACETATE"                         // 再生・半合成繊維
  | "OTHER"
type CompositionData = { fiber: Fiber; percent: number }[]   // 合計 100 でなければ警告（保存は止めない）

// 規格（Material.exportSpec）
type ExportSpec = {
  version: 1
  // 生地（FABRIC / LINING / INTERLINING）
  fabricForm?: "WOVEN" | "KNIT" | "NONWOVEN"
  yarnType?: "STAPLE" | "FILAMENT"                        // 短繊維（紡績糸）／長繊維
  weave?: "PLAIN" | "TWILL_3_4" | "SATIN" | "OTHER"       // 平織／綾織（3枚・4枚）／朱子／その他
  isDenim?: boolean                                       // 綿の先染め綾織 200g 超で使う
  isPile?: boolean                                        // パイル（編物 6001）
  finish?: "UNBLEACHED" | "BLEACHED" | "DYED" | "YARN_DYED" | "PRINTED"  // 未晒／漂白／浸染（後染め）／先染め／なせん
  // 付属
  trimMaterial?: "METAL" | "PLASTIC" | "SHELL" | "WOOD" | "COVERED" | "PAPER" | "TEXTILE" | "OTHER"
  trimForm?: "SLIDE_FASTENER" | "PRESS_FASTENER" | "BUTTON" | "WOVEN" | "PRINTED" | "ELASTIC" | "NARROW_WOVEN" | "OTHER"
  // 判定の記録（P1-D5 で書く）
  hsSource?: "CANDIDATE" | "COPIED" | "MANUAL"           // 候補をそのまま／似た材料から写した／手入力
  copiedFromMaterialId?: string
  decidedAt?: string                                      // ISO
  decidedByUserId?: string
}
```

- 画面の日本語ラベルは同じファイルの定数（FIBER_LABELS など）に置く。目付・幅は既存の fabricWeight・fabricWidth を使う（exportSpec に重複して持たない）
- zod は保存時の検証に使う。exportSpec・compositionData が null（未入力）でも材料は保存できる

### P1-D3 判定の純関数（src/lib/hs/classify.ts）

```ts
type HsResult = {
  code: string | null        // 確定まで行けた番号（例 "5208.33"）。号まで行けなければ null
  heading: string | null     // 項（4桁・例 "5208"）。分かった所まで
  label: string              // 日本語の説明（例 "綿織物（綿85%以上・200g/㎡以下）／浸染／綾織"）
  reasons: string[]          // 根拠の文（画面に並べる）
  missing: (keyof ExportSpec | "composition" | "fabricWeight" | "fabricWidth")[]  // 足りない答え（PR-2 の質問に使う）
  verified: false            // ★木は澁澤WT と照合前。照合が済むまで常に false → 画面に「要確認」
}
classifyHs(input: { materialType; compositionData; exportSpec; fabricWeight; fabricWidth }): HsResult
```

- 主素材＝compositionData の percent が最大の繊維。同率なら HS の注の規定で決まるが、v1 は「要確認」にして missing に composition を返す
- ★v1 の木（HS 2022 の号の並び）。号まで決めきれない所は heading だけ返し、code は null（人が手入力）

| 材料 | 条件 | 結果 |
|---|---|---|
| 綿の織物 | 綿 85% 以上・200g/㎡ 以下 | 5208。号＝仕上げ（未晒 .1x／漂白 .2x／浸染 .3x／先染め .4x／なせん .5x）× 組織（平織 100g/㎡以下 x1・100g/㎡超 x2／綾織 x3／その他 x9）。★なせんは .51（平織100以下）.52（平織100超）.59（その他・綾織も .59）※.53 は無い |
| 綿の織物 | 綿 85% 以上・200g/㎡ 超 | 5209。仕上げ × 組織（平織 x1／綾織 x2／その他 x9）。★先染めは .41 平織／.42 デニム（isDenim）／.43 その他の綾織／.49 その他。なせんは .51／.52（綾織）／.59 |
| 綿の織物 | 綿 85% 未満 | heading のみ（5210〜5212：混ぜた繊維と目付で分かれる）・missing |
| 麻（亜麻）の織物 | LINEN | 5309。85% 以上 .1x／未満 .2x。未晒・漂白 x1／その他 x9 |
| 毛の織物 | WOOL | heading 5111／5112（紡毛か梳毛か）・missing |
| 合成繊維・長繊維の織物 | POLYESTER/NYLON/ACRYLIC・FILAMENT | heading 5407・missing（加工糸か・仕上げ） |
| 再生繊維・長繊維の織物 | RAYON/CUPRO/ACETATE・FILAMENT | heading 5408・missing |
| 合成繊維・短繊維の織物 | STAPLE・85% 以上 | 5512（ポリエステル .1x：未晒・漂白 .11／その他 .19。アクリル .2x・その他 .9x） |
| 合成繊維・短繊維の織物 | 85% 未満 | heading 5513／5514／5515（綿と混ぜたか・170g/㎡ 以下か）・missing |
| 再生繊維・短繊維の織物 | STAPLE | heading 5516・missing |
| 編物 | KNIT・isPile | 6001・missing |
| 編物 | KNIT・幅 30cm 以下 | heading 6002／6003・missing |
| 編物 | KNIT・ポリウレタン 5% 以上 | 6004（幅 30cm 超・弾性糸 5% 以上）・号は missing |
| 編物 | KNIT・その他 | 6006。綿 .2x／合成 .3x／再生 .4x × 仕上げ（未晒・漂白 1／浸染 2／先染め 3／なせん 4） |
| 不織布 | NONWOVEN | heading 5603・missing（重量区分） |
| ファスナー | ZIPPER（SLIDE_FASTENER） | 9607.11（務歯が卑金属）／9607.19（その他） |
| ボタン | BUTTON | 9606.10（PRESS_FASTENER）／9606.21（樹脂・くるみでない）／9606.22（卑金属・くるみでない）／9606.29（その他・くるみ・貝・木） |
| テープ・ゴム | TAPE / ELASTIC（NARROW_WOVEN） | 5806.20（弾性糸 5% 以上）／5806.31（綿）／5806.32（人造繊維）／5806.39（その他） |
| ネーム・品質表示 | LABEL / CARE_LABEL（TEXTILE） | 5807.10（織ったもの）／5807.90（その他） |
| 下げ札 | HANG_TAG（PAPER） | heading 4821・missing（印刷か） |
| 糸 | THREAD | heading のみ（綿 5204／合成長繊維 5401／合成短繊維 5508）・missing（小売用か） |
| 袋・ポリ袋・箱 | PACKAGING_BAG / POLYBAG / BOX | 手入力（code・heading とも null） |
| その他 | OTHER | 手入力 |

- 目付（fabricWeight）が空で 5208/5209 を分けられないときは missing に fabricWeight
- 根拠の文は画面にそのまま出す日本語（例「綿 100% → 綿85%以上 → 52類」「162g/㎡ → 200g/㎡以下 → 5208」「浸染 → 5208.3x」「綾織（3枚・4枚） → 5208.33」）
- ★参考画面の試作は 5208 のなせん綾織を .53 にしていた。正しくは .59（上の表）。参考画面は判断材料で、番号は本書を正とする

### P1-D4 似た材料（案C）— action `listHsReferenceMaterials`

- 入力: materialType・compositionData・（編集中なら）自分の id
- 対象: 同じ会社・deletedAt null・hsCode が空でない材料（自分を除く）。同じ materialType を優先
- 並べ方: ①主素材が同じ ②主素材の混率の差が小さい ③目付の差が小さい ④更新が新しい。上位 10 件
- 返す列: id・materialCode・materialName・composition（文字）・主な規格（組織・仕上げの日本語）・fabricWeight・hsCode・exportSpec.hsSource
- 「写す」は画面のフォームに exportSpec と hsCode を入れるだけ（保存は「保存」ボタン）。hsSource=COPIED・copiedFromMaterialId を付ける。目付など違う所は画面で「違う」と出す（参考画面の案C）
- ★「確定した出荷」（どの輸出インボイスで使ったか）の列は PR-4 以降（インボイスがまだ無い）

### P1-D5 材料フォーム（案A＋C）

- 区画「輸出用の規格」を、HS コード・原産国の入力欄（material-form.tsx:641/661）と同じ区画にまとめる（★STEP 0 ③の並びを見て、既存の HS コード・原産国の欄をこの区画へ移す。欄そのものと保存経路は変えない）
- 区画の中身（上から）:
  1. 「似た材料から写す」（折りたたみ・開くと P1-D4 の一覧・行の「写す」）
  2. 混率（行を足す形：繊維の Select ＋ % ・合計が 100 でなければ黄色の注意）
  3. 素材タイプで出し分ける規格の Select（生地＝織物/編物/不織布・糸の種類・組織・仕上げ・デニム・パイル／付属＝素材・形）。目付・幅は既存の欄をそのまま使い、ここでは「目付 162 g/㎡（上の欄）」のように読んで見せる
  4. 右（狭い幅では下）に HS の候補: 番号（code が null なら heading に「..」）・説明・根拠の文・「要確認」の札（verified=false の間ずっと）・足りない答えの一覧
  5. ボタン「この候補を HS コードに入れる」（code があるときだけ押せる）→ HS コード欄に入れ、hsSource=CANDIDATE。HS コード欄を手で変えたら hsSource=MANUAL
- 原産国（originCountry）は今の Select のまま
- 保存: 既存の createMaterial / updateMaterial に compositionData・exportSpec・referenceUrls を通す（validator → action の data 組み立て行 → AuditLog の before/after）。保存時に decidedAt・decidedByUserId を入れる（hsCode が変わったときだけ）
- ★「保存できる」は action の data 組み立て行に3列が現れることで確かめる（型や表示ではなく）

### P1-D6 材料の詳細

- 節「輸出用の規格」: 混率（「綿 100%」）・規格の日本語・目付・幅・HS コード（＋「要確認」の札・hsSource の日本語「候補から／〇〇から写した／手入力」）・原産国
- 節「根拠」:
  - ファイル: 一覧（名前・追加日・追加した人）・「ファイルを追加」（PDF・PNG・JPG・EML・MSG・20MB まで）・開く（署名 URL）・取り消す（論理削除・AuditLog）。GCS のパスは product-sketches と同じ流儀（STEP 0 ②）
  - URL: referenceUrls の一覧（ラベル・URL・外部リンク）・追加・削除（編集フォームでも直せる）
- action: addMaterialEvidenceFile（FormData）・removeMaterialEvidenceFile・getMaterialEvidenceFileUrl。権限は材料の編集と同じ（今の materials の action と同じ判定を先頭で）

### P1-D7 migration（shunya-environment-safety-check ルール 00）

1. host が hopper.proxy.rlwy.net:12921（dev）であることを確認
2. `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` の出力が `ALTER TABLE "materials" ADD COLUMN "export_spec" JSONB, ADD COLUMN "reference_urls" JSONB;` 相当だけであること。★それ以外が1行でも出たら止めて報告（dev のずれ）
3. `npx prisma db push`（--accept-data-loss は付けない）
4. `prisma/migrations/20261010000000_b211_pr1_material_export_spec/migration.sql` を手書き（冒頭に意図と非破壊のコメント）。2 と一致すること
5. dev サーバを再起動
- ★`prisma migrate dev` / `migrate reset` / `--accept-data-loss` は使わない
- 本番: 列は NULL 可なので既存の行に影響なし

### P1-D8 置き場所（案）

- `src/lib/hs/export-spec.ts`（型・zod・ラベル）・`src/lib/hs/classify.ts`（純関数）・`src/lib/hs/classify.test.ts`
- `src/lib/actions/materials.ts`（既存に追加）・`src/lib/actions/material-evidence.ts`（ファイル）
- `src/app/(app)/materials/_components/export-spec-section.tsx`（フォームの区画）・`reference-materials.tsx`（案C）・`evidence-section.tsx`（詳細の根拠）

## 4. テスト（npx tsx・既存と同じ assert 方式）

- SY8300624 の生地: 綿100%・織物・短繊維・綾織・浸染・162g → code 5208.33・reasons 4 本・verified false
- 同じで 230g → 5209.32／先染め 230g デニム → 5209.42／先染め 230g デニムでない → 5209.43
- なせん・綾織・162g → 5208.59（.53 にならない）／なせん・平織・90g → 5208.51
- 綿 60%・ポリエステル 40% → code null・heading に 5210〜5212 の案内・missing に composition
- 目付が空の綿織物 → code null・missing に fabricWeight
- リネン 100% 先染め → 5309.19／リネン 100% 未晒 → 5309.11
- ポリエステル 100% 短繊維 浸染 → 5512.19
- 編物・綿 100%・浸染 → 6006.22／編物・ポリウレタン 8% → heading 6004
- ファスナー金属 → 9607.11／ボタン樹脂 → 9606.21／ボタン くるみ → 9606.29／スナップ → 9606.10
- ゴムテープ → 5806.20／織りネーム → 5807.10
- 袋 → code・heading とも null
- 既存のテストがすべて通る

## 5. dev の確認（localhost:3001）

dev サーバは本 PR のブランチに git switch し、db push の後に起動し直す。dev の材料は 14 件（MT-004 リネン先染めなど）。

1. 材料の編集で「輸出用の規格」に MT-004 の値（麻100%・織物・平織・先染め）を入れる → 候補 5309.19・要確認の札・根拠の文が出る → 「この候補を HS コードに入れる」→ 保存 → 詳細に規格・HS・「候補から」が出る
2. 別の材料（例 MT-005 リネン）を開き「似た材料から写す」→ MT-004 が一覧の先頭 → 写す → 違う所が出る → 保存 → 詳細に「MT-004 から写した」
3. 新規でファスナー（素材 金属）を作る → 9607.11
4. 綿 60%・ポリエステル 40% → 番号が出ず「足りない答え」と手入力の案内。HS を手で入れて保存 → 「手入力」
5. 詳細で根拠の PDF を追加 → 開ける → 取り消す。URL を追加・削除
6. 混率の合計が 90% → 黄色の注意（保存はできる）
7. 規格を何も入れない材料が今までどおり保存できる（既存の材料の編集が壊れていない）
8. AuditLog に exportSpec・compositionData・referenceUrls の before/after が残る（read-only の SQL で1件確かめる）

## 6. 本番への影響

- マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）。migration は materials に NULL 可の列 2 本だけ
- 本番の材料の規格・HS は、慎太郎さんが運用を始めるときに画面で入れる。PR の確認で本番に入れない
- ★判定の木は澁澤WT と照合前（verified=false）。本番でも「要確認」の札が出続ける。照合が済んだら木を直して verified を true にする（別 PR）

## 7. 作業の約束

- ブランチ feat/b211-pr1-material-export-spec（STEP 0 の main から）。PR 必須
- ゲート: npx tsc --noEmit・触ったファイルの eslint・全体の lint error 合計が BEFORE から増えていない・テスト全部・npx next build（dev サーバ 3001 を止めて実行し、終わったら .next を消す）
- 通れば commit → push → PR open まで。マージは慎太郎さん
- PR 本文に: STEP 0 の実測（SharedFile の DDL・フォームの区画の並び）／migrate diff の出力と手書き migration の一致／判定の木の表（P1-D3）と「澁澤WT と照合前」の注記／§5 の手順／LINT の BEFORE と AFTER

## 8. この PR で作らないもの

- 発注明細の「海外発送」の印・HS の写し・質問（案B）→ PR-2
- 自社の英文・国の英語名 → PR-3
- 輸出インボイス・Excel・PDF → PR-4・PR-5
- HsCode マスターへの番号と英語の説明の追加 → B-017
- 判定の木の澁澤WT との照合・verified を true にすること → 照合の後の別 PR
- 輸出入プロジェクトの HS 判定の取り込み → B-211 の後続（要点が届いてから）
- composition（文字）と compositionData の同期・自動生成
- メールの取り込み（B-206）。根拠のメールは .eml / .msg のファイルとして人が追加する
- B-125 のカテゴリ別の表示（referenceUrls の器だけ先に作る）

END-OF-BRIEF-B211-PR1
