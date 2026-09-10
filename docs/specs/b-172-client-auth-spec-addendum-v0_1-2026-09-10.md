# B-172 クライアント認証・権限 仕様確認書 addendum v0.1 (2026-09-10)

- 種別: addendum（v0.1 の追補。v0.1 は判断待ちの版として凍結し、本書の内容は v1.0 に統合する）
- 親文書: docs/specs/b-172-client-auth-spec-confirmation-v0_1-2026-09-10.md（commit 6c7336f・226行）
- 根拠となる実測: 2026-09-10 14:50〜14:51 JST の RECON-J（read-only・DB 非書き込み・main d4f7610 時点）
- ★本書にしかない識別文字列: RECON-J

## 0. 本書の結論（先に4行）

1. **Q0 は 案0-A で確定。** 認可の器は社外共通の基盤として設計し、初版の適用先はクライアントだけに絞る（§1）
2. **v0.1 §6 の未確認7件のうち6件を全数で確定。** 推定を実測に置き換えた（§2）
3. ★**v0.1 / BACKLOG / 引き継ぎメモに焼かれた数値3件が stale だった。**訂正する（§3）
4. ★**B-199 は「器が無い」ではなく「器はあり、src 実使用は未測定」。**定義を補正する（§4）

## 1. Q0 の確定（慎太郎さん 2026-09-10）

**案0-A を採用する。** 認可レイヤーは社外共通の基盤として設計し、B-172 はその第一適用（クライアント）とする。
工場・仕入先・外注パタンナーへの適用は B-022 で「適用を足す」形にする。

- 根拠: 原設計 §5.7 / §5.9 が社外3種を同じ枠で扱っており、過去の spec も「ガードは B-022 と同時設計」と複数回申し送っている
- ★**「器を共通にする」と「初版で3種すべてを実装する」は別。**初版の適用先はクライアントのみ
- これにより v0.1 §4 Q2 の共通フック置き場所3案は「②3系統が共通で呼ぶ薄い認可関数を新設する」に寄る（Q2 で確定させる）

## 2. RECON-J の実測（全数・head で切っていない）

### 2-1. UserRole は8値（J-1・enum 全文）

OWNER / ADMIN / PRODUCTION / ACCOUNTING / SALES / DESIGNER / STAFF / EXTERNAL

★**原設計との突き合わせで判明した未整理**: 原設計 §1.4 は「社内（shunya、6階層）」と書きながら
**7職種を列挙**している（オーナー／管理者／生産管理／経理／営業／デザイナー／**パタンナー**）。
一方 UserRole に PATTERNER は無く、パタンナーは §5.9 で**社外（外注）**として扱われている。
→ **社内パタンナーと外注パタンナーの区別が未整理。** Q0=案0-A の器設計に直接効くため v1.0 で扱う。

### 2-2. User モデル（J-2・全文確認）

- ★client / supplier / factory / buyer への参照列は**存在しない**（v0.1 §1-4 の再確認）
- role（既定 STAFF）・isExternalUser（既定 false）を持つ。`@@index([companyId, role])` あり＝role で引く索引は在るが分岐には未使用
- ★**セキュリティ系の器が実在**: failedLoginAttempts / lockedUntil / passwordChangedAt / UserLoginHistory[] リレーション（→ §4）

### 2-3. OrderPage モデル（J-3・全文確認）

- **必須（非 nullable）は productId のみ。** password / openFrom / openUntil / restrictedBuyers / themeColor 等はすべて nullable か既定値あり
- isPublic 既定 false ／ accessType 既定 LINK_ONLY ／ status は enum ではなく生 String（既定 "ACTIVE"）
- relation 宣言は無し（scalar FK の house style）。`@@unique([companyId, pageSlug])`

### 2-4. MASTER_ADMIN（J-4・分母 90）

| 区分 | 件数 | 目視 |
|---|---|---|
| .ts | 46 | ★**全46行を目視** |
| .tsx | 44 | ★**本文は未目視**（ファイルパスの一覧のみ取得。UI の出し分けと**推定**） |

- .ts 46行の内訳: **実行判定は20箇所**で、20箇所すべてが `tenantType` 比較（物理削除ガードと他テナント閲覧特権）。残り26行はコメントとエラーメッセージ文字列
- ★**role による判定は0件。** この結論は .tsx の推定には依存しない（§2-5 が全行で独立に示す）

### 2-5. session.user.role の実使用（J-5・全6行を目視）

dashboard のバッジ表示 / header の props / app-shell / with-tenant / auth.ts の2箇所。
**すべて配線と表示で、分岐は1件もゼロ。**（陽性対照: 同条件の tenantType は102件ヒット＝grep は正常）

### 2-6. runWithoutTenantContext（J-6・42ヒットの全数帰属）

| 内訳 | 件数 |
|---|---|
| 定義本体（tenant-context.ts:72） | 1 |
| ラッパ withoutTenantContext（with-tenant.ts:82） | 1 |
| with-tenant.ts:4（import） | 1 |
| import 行 | 20 |
| 実呼び出し | 19 |

- ★実呼び出し19件は**すべて**直前の export が `delete◯◯Permanently`。テナント分離バイパスは**物理削除専用**
- ★判定手法の限界: 「直前の export」は閉じ括弧の外側も拾い得る。厳密な内側判定は v0.1 で5ファイル分を行番号で確定済みで、本書の19件はその同型として扱う
- ★**product-colorways.ts:15 は1ヒットのみ（実呼び出しなし）＝未使用 import の可能性。**1行の目視が要る（§6）

### 2-7. 原価が出る面（J-7・38ファイル）

パターンを明示して再計測した（原価|unitCost|totalCost|costBreakdown|margin|利益）。

lib/actions 7 / lib/pdf 5 / cost-categories/_components 4 / lib/validators 3 / products/_components 3 /
lib/production-estimate 2 / lib/calc 2 / 他12ディレクトリに各1 = 計38

★**lib/pdf が5件ある点に注意。**PDF 出力にも原価が乗るため、ページ・action だけを塞ぐ設計では漏れる。
Q2 でホワイトリスト（案2-A）を採るべき根拠が1つ増えた。

## 3. ★数値の訂正（v0.1 / BACKLOG B-172 / 引き継ぎメモに焼かれた stale 値）

| 対象 | 焼かれていた値 | RECON-J の実測 | 判断 |
|---|---|---|---|
| MASTER_ADMIN | 87件（うち目視50） | **90件**（.ts 46 全行目視 / .tsx 44 未目視） | 90 を正とする |
| session.user.role | 8件 | **6件** | ★前回のパターンが不明なため「減った」とは書かない。測り方の差。結論（配線と表示のみ・分岐0）は不変 |
| runWithoutTenantContext | 17ファイル | **42ヒット / import 20ファイル / 実呼び出し19ファイル** | 19 を正とする |

★**87 と 90 の差はコードの変化ではない。**84e0507 → d4f7610 の3コミットが docs のみであることを
本 addendum の保存ブロック STEP 0 で実測した（docs 以外の変更ファイル 0件・陽性対照として変更総数は 0 でないことを確認）。
したがって差は**測り方**の差である。

★**教訓**: v0.1 は `head -50` の出力から「87件中50件を目視」と正しく書いていたが、
分母の 87 そのものが別の測り方の値だった。**分母も、目視数と同じ強さで測る。**

## 4. ★B-199（認証の基本セキュリティ4項目）の定義補正

B-199 の起票文は「いずれも未実装」と書いたが、schema まで含めると正確でない。

| 原設計 §5.7 の4項目 | schema の器 | src 実使用 |
|---|---|---|
| パスワード強度ポリシー | passwordChangedAt（失効管理の片側のみ） | ★未測定 |
| ログイン履歴記録 | **UserLoginHistory[] が実在** | ★未測定 |
| 不正検知 | **failedLoginAttempts / lockedUntil が実在** | ★未測定 |
| 自動ログアウト | schema 不要（NextAuth の session maxAge 側） | ★未測定 |

★**「未実装」と断定しない。**器は在る。使われているかは測っていない。着手時に grep で実測する。
これは v0.1 §1-4 で「器が在るのに休眠」という形を何度も見ているのと同じ構造である。

## 5. ⑪-1 精査待ち2件の決着（引き継ぎメモ ⑪-1）

| 要件 | 判定 | 根拠 |
|---|---|---|
| 編集競合制御 | ★**新規起票が要る → B-200** | 「編集競合」「排他制御」は0件。「ロック」8件はすべて別物（B-123 期間ロック / B-130 仕様ロック / B-146・B-147 Specification.isLocked / B-142・B-156・B-166・B-192 は「ブロック」の部分一致）。陽性対照「受注」25件で grep の正常性を確認 |
| 表示納期と実納期の分離 | **新規不要** | B-171 の定義欄が既に受けている（2026-09-08 追記・M-002 の5） |

## 6. 本書でも埋まっていないこと（v1.0 までに処理する）

1. ★社外ユーザーが1人も存在しない現状で、この設計を検証する手段（dev に検証用テナント／ユーザーを作るか）＝設計判断
2. MASTER_ADMIN の .tsx 44行の本文（UI の出し分けと推定・未目視）
3. src/lib/actions/product-colorways.ts:15 の1行（未使用 import か否か）
4. Client.displayPattern の dev 実データ（DB 参照のため shunya-environment-safety-check を通してから）
5. ★社内パタンナー（原設計 §1.4 の7職種）と外注パタンナー（§5.9 の社外）の区別（§2-1）

## 7. 次のステップ

1. Q1（社外ユーザーは User を作るか / OrderPage の password 方式か）→ Q2 → Q3 → Q4 → Q5 → Q6
2. v1.0 を起こし、v0.1 §6 を本書 §2 の実測で置き換え、§5 の起票結果（B-197 / B-198 / B-199 / B-200）を反映する
3. 実装ブリーフ（migration は db push → 手書き migration → migrate diff 一致検証 → 本番 migrate deploy。prisma migrate dev は使わない）

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-09-10 | addendum v0.1 | Q0 を案0-A で確定。RECON-J で v0.1 §6 の6件を全数確定。stale な数値3件を訂正（MASTER_ADMIN 87→90・role 8→6・runWithoutTenantContext 17→19）。B-199 の定義を補正（器は実在）。⑪-1 を決着（編集競合→B-200 / 表示納期→B-171 が受領） |
