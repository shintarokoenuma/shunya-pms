# B-243 PR-4 実装ブリーフ — 「マスターの取引条件・編集」の出し分け（2026-10-04）

- 対象: shunya-pms・main `f4c8785`（B-257 = PR #184 のマージ後）を claude.ai 側で直接読んで作成（2026-10-04 22:51〜23:05 JST）
- 前提: PR-1〜PR-3 のブリーフ（C-D・D2・D3）。基盤（`AREA_KEYS`・`AREA_DEFAULTS`・`canSeeArea`・`checkArea`・`requireAreaPage`・`canSeeAreaForSession`）は入っている
- 根拠: 慎太郎さんの回答（MEMO_INBOX M-044）
  - 10:08「はい、一度、見えない状態で進めて下さい。」（⑥マスターの取引条件・口座も一般スタッフは初期値「見えない」）
  - 22:51「マスター（クライアント・仕入先・工場など）の編集を任せる予定はありません。」
- 口座: 仕入先・工場・外注先に口座の欄は無い（自社の「振込先」は設定の行で隠せる）。本 PR の対象外
- schema・migration: **なし**

## 1. 決定事項

- **D4-1 area を1つ足す**: `AREA_KEYS` の末尾に `"masterTerms"`
  - `AREA_LABELS`: 「マスターの取引条件・編集」
  - `AREA_HINTS`: 「クライアント・仕入先・工場・外注先・素材」
  - `AREA_DEFAULTS`: `{ STAFF: "hidden" }`
  - `AREA_DENIED_MESSAGES`: 「この役割ではマスターの取引条件・編集を扱えません」
- **D4-2 対象は5つのマスター**: クライアント・仕入先・工場・外注先・素材。ブランド・バイヤー・納品先・カラー・柄・カテゴリ・加工種別・原価費目は**対象外**（お金の欄が無い）。サイドバーの項目は消さない（一覧と詳細は見える）
- **D4-3 見えない人は「見るだけ・取引条件なし」**（22:51 編集を任せない）:
  - 一覧・詳細は開ける。詳細の「取引条件」のカード（4マスター）・外注先の「料金体系」のカード・素材の「単価」のカード（単価・最小発注数）を出さない。素材の一覧の「単価」の列を出さない
  - 作成・編集・アーカイブ・復元・完全削除はできない。`/new`・`/[id]/edit` は開けない（ダッシュボードへ）。一覧の「新規」ボタン・行の「編集」・詳細の「編集」とアクションのメニュー（ClientActions など）を出さない
- **D4-4 サーバでも外す**（PR-2 の BOM と同じ考え・画面で隠すだけにしない）: `getClient`・`getSupplier`・`getFactory`・`getContractor`・`getMaterial` は、見えない人には D4-3 のカードに出している列を **null にして返す**。`listMaterials` は `unitPrice`（と単価の通貨など同じカードの列）を null。どの列かは各詳細ページのカードの中身を現物で数えて決める
- **D4-5 止めるもの**（action・requireSession の直後に `checkArea("masterTerms")`）: 5マスターの create* / update* / archive* / restore* / check*Usage / delete*Permanently。get* と list* は止めない（D4-4 で列を外す）
- **D4-6 止めないもの**: `listClients`（with-tenant.ts からも呼ばれる・金額なし）・`listActiveSuppliersForMaterialSelect`・`listAssignableUsers`。クライアントの詳細の「ブランド追加」「バイヤーを追加」（ブランド・バイヤーは対象外）。素材の単価を使う BOM の選択肢（PR-2 で cost によって外し済み）
- **D4-7 ほかの画面のマスターの取引条件**: 受注の詳細（前受金の比率）・請求書（締日）などはそれぞれの area（sales・accounting）で既に隠れている。本 PR では触らない

## 2. 作るもの・変えるもの

### 2-1. 純関数 `src/lib/settings-visibility.ts`
D4-1 の4つの定数に masterTerms を足す

### 2-2. 画面（ページ）
- 新規 `src/app/(app)/{clients,suppliers,factories,contractors,materials}/new/layout.tsx` と `.../[id]/edit/layout.tsx`（計10本）: `await requireAreaPage("masterTerms")`。layout を置けない作りなら各 page の先頭で同じことをする
- 5マスターの一覧（page.tsx と *-table.tsx）: `canSeeMasterTerms` を取り、false なら「新規」ボタンと行の「編集」（とアーカイブ等の操作）を出さない。「操作」の列が空になるなら列ごと出さない。素材の一覧は「単価」の列を出さない
- 5マスターの詳細（[id]/page.tsx）: false なら D4-3 のカードと「編集」ボタン・アクションのメニューを出さない

### 2-3. Server Action
- D4-5 の判定（5ファイル × 6本前後。名前は現物で数える）
- D4-4 の get* / listMaterials の列外し

### 2-4. 全体検索
- マスターの検索結果は名前とコードだけなら変更なし（現物で確かめ、取引条件や単価が出ていれば同じく外す）

## 3. テスト（`src/lib/user-management.test.ts` に ⑪ を足す）
1. 空の設定で STAFF は masterTerms を見られない。PRODUCTION / ACCOUNTING / SALES / DESIGNER は見られる
2. `areas.masterTerms.STAFF = "view"` で STAFF が masterTerms を見られ、ほかの5つは見られないまま
3. OWNER / ADMIN は hidden が書かれていても見られる。EXTERNAL・null は見られない
4. ⑧〜⑩ が通る（visibleAreas の期待値は6つに増えるので更新してよい）

## 4. 確認（dev・localhost:3001）
★確認用ユーザーのパスワードは `<新しいパスワード>`（< と > を含む）。役割ごとにウィンドウを分ける。
一般スタッフ（dev-staff）で:
1. サイドバーの「マスター」はクライアント〜原価費目まで今まで通り出る
2. クライアント 葵アパレル（/clients/e99a8a06-7125-44d8-aa11-559b7e2f026e）: 「取引条件」のカードと「編集」・メニューが無い。基本情報・連絡先・ブランド一覧・関連バイヤーは見える
3. 仕入先・工場・外注先の詳細を1つずつ: 「取引条件」（外注先は「料金体系」も）が無く、「編集」が無い
4. 素材の一覧に「単価」の列が無い。素材の詳細に「単価」のカードが無い
5. クライアント・素材の一覧に「新規」ボタンが無い。`/clients/new`・`/materials/new`・`/clients/<葵アパレルのid>/edit` を直接開くとダッシュボードへ戻る
生産管理（dev-production）で:
6. 2〜5 がすべて今まで通り（取引条件・単価・編集・新規が出る）
管理者（dev-admin）で:
7. 「役割と権限」の「画面」の表が6行（末尾「マスターの取引条件・編集」）で、一般スタッフが6つとも「隠す」

## 5. 本番への影響
- マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）
- 本番の User はオーナー1人（2026-10-04 時点）。見え方が変わる人はいない
- migration なし。本番の CompanySetting は書き換えない

## 6. 作業の約束
- ブランチ `feat/b243-pr4-master-terms-visibility`（main `f4c8785` から）。PR 必須
- `npx tsc --noEmit`・触ったファイルの lint・`npx tsx src/lib/user-management.test.ts`・`npx next build`（3001 の dev を止めて実行 → `.next` を消す → このブランチで dev を 3001 で起動し直す。止めてよい＝慎太郎さん了承済み）が通れば commit → push → PR open まで。マージは慎太郎さん
- "use server" のファイルから文字列の定数を export しない
- 新しいクエリは companyId と deletedAt: null を手書き（AGENTS.md）
- 本書を `docs/specs/b-243-pr4-implementation-brief-2026-10-04.md` として PR に同梱する

## 7. 本 PR で作らないもの
- 対象外のマスター（ブランド・バイヤー・納品先・カラー等）の編集の制限
- 「見えるが編集できない」を area ごとに分ける段階（今回は「取引条件」と「編集」を1つの行で扱う）
- 輸出書類（B-110）・支払（B-212）の行

END-OF-BRIEF-B243-PR4
