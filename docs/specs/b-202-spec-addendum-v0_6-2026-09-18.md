# B-202 品番カルテ1画面化 仕様確認 addendum v0.6（PR-3 / PR-4 の確定・B-202 完了）

- 識別子: SWITCH-BASE
- 日付: 2026-09-18（JST・作業日）。repo への保存は 2026-09-19 朝
- 位置づけ: v1.0 / addendum v0.1〜v0.5 を補完する。食い違う場合は本書が上位。一次資料はモック「品番カルテ 3案」案C（v0.3 §0 の URL）
- 契機: PR-3（メモ＝Comment の配線）と PR-4（表示スイッチ）の実装で、モックと spec の記述から2点ずれたため

## 0. 本書で変わったこと（2行）

1. メモの行に時刻を出す（モック原文は日付のみ）。D-25
2. 段階1のスイッチ対象を「Comment の未実装機能」から「PR-3 で実装した3つの表示要素」に変えた。既定はオフではなくオン（現状維持）。D-26

## 1. 確定事項

### D-25 メモの行は「MM/DD HH:mm 名前　本文」（モック原文からの逸脱）

- モック案C の表示例は「09/10 中谷　付属の入荷が2日遅れ。…」＝日付のみ
- 慎太郎さんの判断（2026-09-18）: 同じ日に何度もメモを足すため、日付だけでは間隔が読めない。時刻を出す
- 実装: memo-section.tsx の fmtDateTime（24時間表記・月日時分ゼロ埋め・ブラウザのローカル時刻）
- ★モックからの逸脱であることをファイル冒頭コメントに明記した（ルール 2r の運用）

### D-26 段階1のスイッチ対象は「今ある3つ」。既定はオン

v1.0 D-8 は「段階1のスイッチ対象は D-7 の使わない列（返信・メンション・添付・種別・重要度・解決状態・ピン留め・リアクション・多言語）、既定はすべてオフ」と定めていた。

- ★PR-3 はそれら9機能を1つも実装していない（action は列を書かず、UI にも出していない）。したがって隠す対象が存在せず、D-8 の既定オフは適用できない
- 慎太郎さんの判断（2026-09-18）: PR-4 は土台だけ作る。スイッチ対象は **時刻 / 書いた人 / 「編集済み」の印** の3つ、既定は3つともオン（現状維持）
- 保存先は v1.0 D-8・v0.2 D-11 のとおり `CompanySetting.uiPreferences.productKarte.memo.*`（段階3＝B-203 へ移せる名前空間）
- ★D-8 の「既定オフ」は未実装機能に対する規定として有効なまま残す。機能を作る時に段階2/3（B-203）の基盤で扱う

## 2. 実装の記録（main ea0ba30 時点）

### PR-3（PR #147・squash 64c07de・3 commit・schema/migration ゼロ）

- 新規: `src/lib/types/comment.ts` / `src/lib/validators/comment.ts`（content は trim・1〜2000文字）/ `src/lib/actions/comments.ts`（list / create / update / delete）/ `src/app/(app)/products/_components/memo-section.tsx`
- 変更: `products/[id]/page.tsx` 右カラム⑦（進行の直下）に配置
- 書く列: companyId / attachedToType="product" / attachedToId / content / contentFormat="PLAIN" / authorUserId / authorRole。commentType・priority・language・isExternalAuthor は DB 既定に任せる
- update は自分のメモのみ。isEdited / editedAt を立て、originalContent は null のときだけ初版の文面を残す。delete は deletedAt の論理削除
- ★role=EXTERNAL は既定拒否（list は空配列・書き込みは拒否）。B-172 は未実装だが担保を先に置いた
- 書いた人の名前は comments.ts 内の private ヘルパーで一括解決（companyId スコープ・N+1 なし・deletedAt で絞らない）

### PR-4（PR #148・squash ea0ba30・2 commit・schema/migration ゼロ）

- 新規: `src/lib/company-setting-defaults.ts`（必須 Json 7本を {} ＝未設定）/ `src/lib/types/ui-preferences.ts`（既定3つとも true・canManageCompanySettings）/ `src/lib/validators/company-setting.ts` / `src/lib/actions/company-settings.ts`
- get は行が無くても作らない。update は upsert で、create のみ必須7本を埋め、update は uiPreferences だけを書く
- ★uiPreferences の他の名前空間は読み出して残したまま書き戻す（丸ごと置換しない）
- ★更新は OWNER / ADMIN のみ（UserRole 実測 8値）。歯車は管理者相当にしか出さず、サーバ側でも拒否
- revalidatePath("/products", "layout")（会社の既定は全カルテに効く）

## 3. 教訓

1. ★**spec の既定値は、前提となる機能が実装されているかを測ってから適用する。** D-8 の「既定オフ」は Comment の9機能が画面に出ている前提の規定で、最小限で作った PR-3 とは噛み合わなかった。spec と実装のどちらも正しく、前提だけがずれていた
2. ★**role で権限のゲートを作る前に、その role を運用で変える手段があるかを測る。** 2026-09-18 の recon で、ユーザー管理の画面・action は存在せず、ユーザーは prisma/seed.ts でしか作られないと判明した（→ B-205 起票）。既存の特権判定は tenantType 側に寄っている
3. JSX は要素間の空白行を落とす。全角空白を区切りに使う場合は {"　"} と明示的に書く（PR-3 で実際に落ちていた）

## 改訂履歴

- v0.6（2026-09-18, SWITCH-BASE）— D-25 / D-26。PR-3・PR-4 の実装記録。B-202 は本書で完了
- v0.5（2026-09-17, SKETCH-BAND）
- v0.4（2026-09-16, PR1R-DONE）
- v0.3（2026-09-15, MOCK-C）
- v0.2（2026-09-15, RECON-M）
- v0.1（2026-09-13, QLOG-B202）
- v1.0（2026-09-12, RECON-L）

★このメモはここで終わり（END-OF-ADDENDUM-V06）
