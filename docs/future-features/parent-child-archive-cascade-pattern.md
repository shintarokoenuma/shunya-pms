# 親 archive 時の子連鎖パターン（master-patterns v1.3 候補）

**作成日**：2026-05-27
**作成者**：Shin（肥沼慎太郎）+ Claude
**ステータス**：構想段階（Phase 1A-10 完了時に master-patterns 改訂候補として検討）
**起点**：Phase 1A-10 仕様確定議論（D-3：Buyer アーカイブ時の DD の挙動）

---

## 1. 課題

shunya のマスター CRUD パターンで、親マスターと子マスターが FK で関連付けられている場合、**親を archive したときに子をどう扱うか**が複数マスターで再三発生する論点。

例：

- Buyer archive → 配下の DeliveryDestination はどうするか？
- Brand archive → 配下の ModelCode はどうするか？
- Client archive → 配下の Buyer / Brand はどうするか？
- ModelCode archive → 配下の Product はどうするか？

→ 統一パターンを定義しないと、マスター実装ごとに判断がブレる。

## 2. 検討した 3 つのパターン

### パターン α：何もしない（独立管理）

- 親を archive しても子はそのまま
- ユーザーが個別に子を archive する必要あり

**メリット**：
- 実装シンプル（DB トリガー不要、コード追加なし）
- ユーザーの操作意図を尊重（一括処理の事故を防ぐ）

**デメリット**：
- 「親が ARCHIVED なのに子が ACTIVE のまま」という不整合状態
- 業務 UI で「親は archive されているけど子は選択肢に出る」のような矛盾
- ユーザーが「親 archive 時に子も全部 archive すべきだった」と後で気づく

### パターン β：強制連鎖アーカイブ

- 親を archive する → 配下の ACTIVE な子を**全部自動 archive**
- archive 時の確認ダイアログで「N 件の子も同時にアーカイブされます」を明示

**メリット**：
- データ整合性が保たれる
- 業務 UI で archive 状態が一貫
- 業務的に自然（親が休業 → 子も休業）

**デメリット**：
- 復元時の挙動が複雑（親復元したら子も復元？個別判断？）
- 「うっかり親を archive して、配下の 20 件子も全部 archive されてしまった」というインシデント懸念
- 復元前提の archive と「完全廃止」の archive の区別がつきにくい

### パターン γ：警告 + ユーザー選択（推奨パターン）

- archive 時に「配下子の状態」を表示
- チェックボックスで連鎖アーカイブを選択可能
- デフォルトはチェック ON（連鎖、ただしユーザーが OFF にできる）

**メリット**：
- ユーザー判断を尊重しつつ、不整合状態を可視化
- うっかり連鎖の事故を防ぐ
- 配下が空の場合は確認なしで通常 archive

**デメリット**：
- 実装やや複雑（archive 前に配下子の数を取得する必要）
- 復元時の挙動も別途検討必要

## 3. パターン γ の標準仕様（推奨）

### archive 時の挙動

1. 親の archive ボタン押下
2. 配下に ACTIVE な子が **0 件** の場合：通常の archive 確認ダイアログ（子の話題なし）
3. 配下に ACTIVE な子が **1 件以上** の場合：
   - 確認ダイアログに「配下 ACTIVE な子: N 件」を表示
   - 「☑ 配下の子も同時にアーカイブする」**チェックボックス（デフォルト ON）**
   - 配下子のリスト（最大 5 件 + "他 X 件"）を表示
   - [キャンセル] [アーカイブ実行] ボタン
4. 実行：
   - チェック ON → 親 + 該当子を同一トランザクションで archive
   - チェック OFF → 親のみ archive

### restore 時の挙動

**シンプルに「親のみ復元」**。配下子の復元は別途ユーザー判断。

理由：

- archive 時に連鎖したとしても、半年後の復元時には「どれを ACTIVE に戻すか」は再判断すべき
- 「業務再開時に全部復活」とは限らない（一部だけ閉店継続など）
- restore 時に「N 件の子が ARCHIVED 状態です。確認しますか？」とアナウンス → 一覧で個別 restore

### 物理削除時の挙動

`onDelete: Cascade` 維持。物理削除は MASTER_ADMIN 限定 + 確認名入力 + 紐付き 0 件チェックの 3 重ガードがあるので、Cascade で問題ない。

### 実装方針

```typescript
async function archiveParent(id: string, options: {
  cascadeArchiveChildren: boolean
}): Promise<{ parent: Parent, cascadedCount: number }> {
  return await prisma.$transaction(async (tx) => {
    const parent = await tx.parent.update({
      where: { id },
      data: { status: ParentStatus.ARCHIVED }
    })
    
    let cascadedCount = 0
    if (options.cascadeArchiveChildren) {
      const result = await tx.child.updateMany({
        where: { parentId: id, status: ChildStatus.ACTIVE },
        data: { status: ChildStatus.ARCHIVED }
      })
      cascadedCount = result.count
    }
    
    await tx.auditLog.create({ /* archive 記録 + cascade 情報 */ })
    return { parent, cascadedCount }
  })
}
```

UI 側で archive ダイアログ実装時に、事前に `checkParentUsage(id)` 相当で **配下子の数** を取得。

## 4. 対象となるマスター関係

shunya の現状 / 将来のマスター関係で、このパターンが適用できる候補：

| 親 → 子 | 関係 | 適用判定 |
|---|---|---|
| Buyer → DeliveryDestination | 必須 FK、Cascade delete | ✅ Phase 1A-10 で適用確定 |
| Brand → ModelCode | （Phase 1A-12 で設計）| ✅ 適用候補 |
| Client → Buyer | 任意 FK | △ 任意 FK のため判断要 |
| Client → Brand | 必須 FK | ✅ 適用候補 |
| ModelCode → Product | （Phase 1B で設計）| ✅ 適用候補 |
| Supplier → Material | （Phase 1A-13 で設計）| △ 仕入関係なので別判断 |

## 5. master-patterns v1.3 への昇格判断

### 昇格すべき場合

- 上記候補の **3 件以上** で同じパターン γ を採用予定
- パターン γ の挙動が業務的に他のマスターでも妥当と判断
- 実装パターン（archiveXxx の cascadeArchiveChildren オプション）が再利用可能

### 昇格しない場合

- マスターごとに挙動を変えたい強い理由がある
- パターン α / β / γ を使い分ける戦略

### 現時点の判断

**昇格候補（v1.3 で正式追加）**。理由：

1. Buyer → DD で確定したパターンが業務的に自然
2. 同じパターンを Brand → ModelCode、ModelCode → Product でも採用したくなる可能性が高い
3. shunya-master-patterns に明示されていないと、Phase 1A-12 以降の実装で再議論が必要になる

## 6. v1.3 改訂案（master-patterns への追記内容）

`docs/shunya-master-patterns.md` に以下のセクションを追加する想定：

```markdown
## XX. 親マスター archive 時の子マスター連鎖パターン

### パターン γ（標準）：警告 + ユーザー選択

親マスターが子マスターと FK で関連付けられている場合、親 archive 時の子の挙動は以下を標準とする：

#### archive 時

1. 配下に ACTIVE な子が 0 件の場合：通常の archive
2. 配下に ACTIVE な子が 1 件以上の場合：
   - 確認ダイアログで配下子の数 + 子の一覧（最大 5 件）を表示
   - 「☑ 配下の子も同時にアーカイブする」チェックボックス（デフォルト ON）
   - チェック ON → 親 + 子を同一トランザクションで archive
   - チェック OFF → 親のみ archive

#### restore 時

親のみ復元、配下子の復元は別途ユーザー判断。
「N 件の子が ARCHIVED 状態です」とアナウンス → 一覧で個別 restore。

#### 物理削除時

onDelete: Cascade 維持（MASTER_ADMIN 限定 + 確認名入力 + 紐付き 0 件チェックで安全担保）。

### 実装パターン

archiveParent 関数に `cascadeArchiveChildren: boolean` オプションを追加。
内部で `prisma.$transaction` を使い、親と子を同一トランザクションで処理。

### 適用マスター（Phase 1A-10 時点）

- Buyer → DeliveryDestination
- （Phase 1A-12 以降）Brand → ModelCode、Client → Brand など

### 例外（パターン α / β の採用）

以下の場合はパターン γ を使わない：

- 配下子の独立性が業務的に強く、親 archive と無関係 → パターン α
- 配下子の数が 1 件固定で常に連鎖が自然 → パターン β（Cascade）
```

## 7. 関連ドキュメント

- `docs/phase1a-10-spec-confirmation-2026-05-27.md`：本パターンの起点議論（D-3）
- `docs/shunya-master-patterns.md` v1.2：実装パターン集（v1.3 で本パターン追加候補）
- `docs/phase1a-11-spec-confirmation-2026-05-25.md`：Buyer の archive 仕様（連鎖は議論されず）

---

**判断時期**：

- Phase 1A-10 実装完了時：パターン γ が実装され、動作確認が取れる
- Phase 1A-12（ModelCode）仕様確定議論時：Brand → ModelCode への適用を判断
- master-patterns v1.3 改訂時：本パターンを正式追加するか最終判断
