# 引き継ぎメモ (2026-06-17 セッション7 / B-027 絵型 完了 PR #86・#87 本番反映・北極星5要素 完成)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト混入ファイル。無視。docs 整理は B-037。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)。型/lintクリーンなら commit→push→PR open まで Claude Code 自走可。人が握るのは①ローカル目視と②マージ。
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)。
- ③ マージ後=本番URL + デプロイログ目視。migration入りPRは「Applying migration ...」行が③の本体。migration なしPRは「No pending migrations to apply.」が正常（エラーではない）。
- 【dev起動の罠】schema/migration変更後に dev が古いプロセスを掴むと prisma.<新model> が undefined → findFirst / Internal Server Error。対処: lsof -ti:3000,3001 | xargs kill -9 → npx prisma generate → rm -rf .next → npm run dev。起動ポートが3001にズレてないか必ず確認。
- 【index-browser 罠】"use client" のコンポーネントが "use server"（prisma 同梱）の actions ファイルから型を import すると、ブラウザバンドルに @prisma/client が漏れ `.prisma/client/index-browser` 解決エラーになる（import type でも漏れる）。対処=型を中立モジュール（src/lib/types/*.ts・prisma非依存）に逃がす。B-027 でも product-sketch.ts を types/ に置いた。
- 【本番確認の罠】「データ0件なら出さない/データ依存」系UIは本番にデータが無いと変更が見えない＝バグではない。本番反映の確認はデータ非依存の変更点で見る（B-027 は「絵型カードが空でも表示・追加ボタンが出る」で確認）。本番に検証データを入れない。
- 【監査網羅型の罠】Product にスカラ列を足すと products.ts の `ProductAuditField`（ProductScalarFieldEnum から Exclude）が新列を要求しビルド失敗する保険。updateProduct が触らない列（B-027 の sketchImages/sketchThumbPath 等）は Exclude に追加する。

## ① 本セッションの成果（B-027 絵型 完了＝北極星5要素 完成）
- PR #86（squash d9a891a）= 品番カルテ「絵型（服のスケッチ）」(B案 Product直持ち・複数枚 Json 配列)。migration 33本目（products に sketch_images JSONB / sketch_thumb_path VARCHAR(500) ADD COLUMN×2・非破壊）。sharp で長辺400px WebP サムネ生成。GCS アップロード（原本＋サムネ）。詳細カード＋一覧サムネ列。本番反映済み。
- PR #87（squash fa9121f）= 絵型の複数枚アップロード＋ドラッグ&ドロップ（client 直列ループ・サーバ無改修・migration なし）。本番反映済み。
- これで北極星5要素（製品コード / 数量マトリクス / カラー展開 / 付属マトリクス(BOM+カラーウェイ C/#) / 絵型）が**全て品番カルテに揃った**。

## ② B-027 設計の確定事項（実装で確定）
- Product 直持ち：`sketchImages Json?`（全枚数 [{gcsPath, thumbGcsPath, caption?, sortOrder}]）＋ `sketchThumbPath String?`（一覧/進行表用に先頭サムネを非正規化）。DesignVersion.flatSketch とは別レイヤー（スナップ層）。
- sharp 依存追加＋next.config の serverExternalPackages に "sharp"。サムネ長辺400px・WebP。生成失敗時は原本のみ保存し thumbGcsPath=gcsPath にフォールバック（表示を壊さない）。
- gcs.ts `uploadProductSketch`（原本＋サムネ2オブジェクト・パス sketch/{productId}/{JST}・graceful degradation）。`getSignedReadUrl` 流用（15分署名）。
- actions/product-sketches.ts：add/delete/reorder/getUrls。5MB・png/jpeg/webp・20枚上限・companyId スコープ・AuditLog（add_sketch/delete_sketch）。GCS は残置（既存方針＝孤児許容・delete 関数なし）。
- 複数枚は client 直列ループ（for...of await）でサーバ無改修。並列にしない＝サーバの「最新読み直し→追記」が last-write-wins のため。
- 絵型カードは「ステータス履歴」と「カラー展開」の間に配置。

## ③ Railway環境（唯一の正）
- 本番DB postgres-production/postgres-ab6d/shuttle:16099（migrate deploy・_prisma_migrations あり）。
- dev DB postgres-development/hopper:12921（db push・_prisma_migrations 無し・migrate系打たない）。
- migration 33本（本セッションで +1: 20260617000000_b027_product_sketch）。GCS dev=...-dev / prod=...-prod。
- ⚠️ sharp はネイティブ依存。ローカル(mac)ビルドは通過。本番 Railway(linux-x64) ビルドが #86 デプロイで通ったことをデプロイログで確認（マージ済み＝通った前提だが、次セッション冒頭で本番の絵型アップロードが実際に動くか smoke 推奨）。
- Prisma 6.19.3→7.8.0 メジャーアップ案内はデプロイログに出るが未対応・今は無視。

## ④ dev DB（hopper:12921）
- テスト品番 AOI-26AW-CUT_SEWN-001（id 7671eb90-4bc8-46e0-996b-2e119550be80）：colorways/bom_item_colorways は B-062/063 検証分、bom_items=5 / po_items=5 / skus=0。sketch_images は検証で投入していれば残存（掃除任意）。colors=51（dev/本番一致）。
- 本番 product_colorways=0 / bom_item_colorways=0（クリーン）。

## ⑤ 次セッション優先順
1. **柄・特色マスター（新規・要起票 B-066 等）**＝下記⑥。Color の兄弟 TextilePattern（仮称）。受け皿 spec は docs/textile-pattern-master-spec-confirmation-2026-06-01 にあり（§7 未実装・§6 未確定論点10個）。UI 方針確定済み: ProductColorway に色(colorId)と並べて柄(patternId)参照を1本足す（カラーウェイの正体の一種）。着手前に design-reread で textile-pattern spec §6 と color-master を読み直す。
2. **B-063 残（帳票フェーズ）**：colorNameEn 追加 migration / Material.availableColors 改訂1 / Sku 色 FK 化 / ProductColorway.colorId の FK 正規化。
3. **B-065**（発注引き当て時の C/# 自動反映）。PoItem は color/colorCode を持つ（確認済み）。
4. B-060(B=SPタイトル方針①相乗り)・継続項目は据え置き。
5. QE-1（量産見積・取り切り）は北極星完成済みなので着手可能になった。再開時に Excel2点を参照資料化・再添付依頼。QE-1仕様書は Specification 経由BOM前提で古い＝決定2(Product直結正系)に合わせ見直し。

## ⑥ 柄・特色の次テーマ（前セッション方針整理を継承）
- TextilePattern（仮称・型紙 PatternVersion と衝突回避で命名要確定）。層1=種別(BD/ST/CK/DT/PR/AO=総柄/ML/OT)＋層2=構成色(Color番号参照)＋parameters(Json)。テーブル/UI 未実装。
- 3例の行き先：ボーダー/チェック/ドット/プリント=種別に有り。迷彩=総柄(AO)かその他(OT)。蛍光・メタリック=「柄」でなく「特殊単色」で柄マスター対象外＝別問題（当面 Color に近似hex追加 or 保留）。
- UI 方針（確定）：カラー展開と数量マトリクスの間に新ボックスは挟まない。柄は「カラーウェイの正体の一種」。ProductColorway に patternId 参照を colorId の隣に増設。柄選択時はスウォッチ代わりに簡易プレビュー（縞/格子）。数量マトリクスは不変。

## ⑦ 本日マージされた PR / push
- PR #86: B-027 絵型本体（squash d9a891a・migration 33本目・本番反映）。
- PR #87: B-027 複数枚＋D&D（squash fa9121f・migration なし・本番反映）。
- docs: 本メモ更新（main 直push）。
- main 先頭: fa9121f(#87) → d9a891a(#86) → 8fc4a73(docs) → afa676e。
- 後始末: ローカル feat/b027-product-sketch・feat/b027-multi-upload-dnd 削除済み。

## ⑧ 1ページ傘下 backlog（更新）
- B-064 数量マトリクス=完了(#82) / B-062 β=完了(#83+#84) / B-063(B-2)=完了(#85) / B-027 絵型=完了(#86+#87)。**北極星5要素 完成**。
- B-063 残（colorNameEn/availableColors改訂/Sku FK化/colorId FK正規化）=帳票フェーズ。
- 柄・特色マスター（B-066 等・要起票）=⑥。B-065（発注引き当て時C/#自動反映）。
- B-061(C)=不要クローズ / B-060(B=SPタイトル)=方針①相乗り。
- 継続: B-048 / WorkOrder編集UI / B-037(docs整理：git status 未追跡散乱・3群仕分け) / SKU 生成導線（希望数の出どころ確定後）。
- 【UI将来要望】資材表の列順ドラッグ並び替え＋ユーザーごと列順保存（列順の永続化が要る・別タスク）。
- QE-1 は北極星完成済みで着手可（⑤-5）。B-057 は QE-1後。逆転記(A)不要確定。

## ⑨ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元
2. git log origin/main --oneline -5 で先頭が fa9121f か確認
3. 本番 smoke: 品番カルテで絵型が表示され、画像アップロード（sharp サムネ生成）が本番で実際に動くか確認（sharp の linux ビルド最終確認を兼ねる）
4. 着手タスクの spec を shunya-design-reread で読み直してから設計（記憶で組み立てない・色マスターの轍）
5. ⑤の優先順から着手（柄・特色マスター起票 or B-063残/QE-1）。schema 変更を伴うものは dev=hopper 確認→手書きmigration→migrate diff 空差分→本番 migrate deploy の三重ガード
