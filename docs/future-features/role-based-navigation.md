# サイドバーのロール別グルーピング案

**作成日**：2026-05-27
**作成者**：Shin（肥沼慎太郎）+ Claude
**ステータス**：構想段階（Phase 1A 完了直前 or Phase 1B 着手時に実施）
**起点**：Phase 1A-10 仕様確定議論（4 ロール視点での利用パターン整理）

---

## 1. 課題

現状のサイドバーナビゲーション（推測）は **フラット並び**：

```
- /clients
- /brands
- /suppliers
- /factories
- /contractors
- /buyers
- /delivery-destinations
- /product-categories
- /expense-categories
- /materials（Phase 1A-13 で追加予定）
- /model-codes（Phase 1A-12 で追加予定）
```

利用者がどのロール（オーナー / 生産管理 / 営業 / 経理）かに関わらず、すべてのマスターが同じ階層で表示される。

## 2. 4 ロールの主要業務と関連マスター

Phase 1A-10 仕様確定議論で整理した内容：

| ロール | 主要業務 | 主に使うマスター |
|---|---|---|
| **オーナー** | 全体俯瞰、戦略判断 | 全マスター（横断的）|
| **生産管理** | 品番、生産進捗、BOM | Brand / ModelCode / Supplier / Factory / Contractor / Material |
| **営業** | 商談、見積、受注 | Client / Buyer / DeliveryDestination / Brand / Inquiry |
| **経理** | 請求、入金、税務 | Client / ExpenseCategory / Invoice / Payment |

## 3. グルーピング案

### 案 A：機能別グルーピング（推奨）

```
[取引先]
- /clients          （経理メイン、営業も使用）
- /buyers           （営業メイン）
- /delivery-destinations  （営業 + 物流）
- /brands           （営業 + 生産管理）

[生産]
- /suppliers
- /factories
- /contractors
- /materials        （Phase 1A-13）
- /model-codes      （Phase 1A-12）

[共通・分類]
- /product-categories
- /expense-categories

[業務トランザクション]（Phase 1B 以降で追加）
- /inquiries        （問い合わせ）
- /projects         （案件）
- /quotations       （見積）
- /purchase-orders  （発注）
- /sales-orders     （受注）
- /invoices         （請求）

[システム]
- /users
- /settings
```

**メリット**：

- マスターの **業務的な意味** で分類されているので、新人が迷わない
- 「取引先 → Brand」のように上から下へ自然に流れる
- 業務トランザクション追加時の場所が明確
- ロールに依存せず誰でも使いやすい

**デメリット**：

- 「Brand は取引先？生産？」のような分類迷いが出る場合がある
- ロール特化の最適化ではない

### 案 B：ロール別グルーピング

```
[営業ツール]
- /clients
- /buyers
- /delivery-destinations
- /inquiries
- /quotations

[生産管理ツール]
- /brands
- /model-codes
- /products
- /suppliers
- /factories
- /materials

[経理ツール]
- /invoices
- /payments
- /expense-categories

[マスター]
- /product-categories
- /contractors

[システム]
- /users
- /settings
```

**メリット**：

- ロール特化なので、各ロールが「自分の道具箱」を持てる
- 認知負荷が下がる（営業スタッフは生産マスターを意識しなくていい）

**デメリット**：

- マスターが複数ロールで使われる場合に重複表示 or 場所迷いが出る
- オーナーは横断的に見たいので逆に不便
- 「Brand は営業の道具」「Brand は生産管理の道具」両方なので分類が苦しい

### 案 C：階層的グルーピング（マスター + 業務）

```
[マスター]
  [取引先]
  - /clients
  - /buyers
  - /delivery-destinations
  - /brands
  [生産先]
  - /suppliers
  - /factories
  - /contractors
  [素材・分類]
  - /materials
  - /model-codes
  - /product-categories
  - /expense-categories

[業務]（Phase 1B 以降）
- /inquiries
- /projects
- /quotations
- /purchase-orders
- /sales-orders
- /invoices

[システム]
- /users
- /settings
```

**メリット**：

- マスターと業務トランザクションがはっきり分離される
- マスター内の細分化（取引先 / 生産先 / 素材・分類）が業務的に自然

**デメリット**：

- 2 階層メニューは操作性が落ちる場合がある（クリック数増）
- 折りたたみ UI の実装コスト

## 4. 推奨：案 A（機能別、フラットグルーピング）

### 理由

1. **MVP として最もシンプル**：階層なしでカテゴリ別の見出しを入れるだけ
2. **業務トランザクション追加時の場所が明確**：Phase 1B 以降の拡張に対応しやすい
3. **ロール依存しない**：全ロールが同じメニューを見るので、トレーニングや引き継ぎが楽
4. **「Brand は取引先」と一括分類する判断**：Brand は Client 配下なので「取引先」グループ内に置くのが自然
5. **オーナー視点で全体俯瞰しやすい**：1 階層のグルーピングは見渡しが効く

### Phase 1B 以降の対応

業務トランザクションが増えてきたら、グループ「業務トランザクション」を追加して同じく機能別に並べる。

## 5. 実装の選択肢

### Option 1：見出しのみのフラットグルーピング（推奨）

```tsx
<Sidebar>
  <SidebarGroup label="取引先">
    <SidebarItem href="/clients">Clients</SidebarItem>
    <SidebarItem href="/buyers">Buyers</SidebarItem>
    <SidebarItem href="/delivery-destinations">Delivery Destinations</SidebarItem>
    <SidebarItem href="/brands">Brands</SidebarItem>
  </SidebarGroup>
  <SidebarGroup label="生産">
    ...
  </SidebarGroup>
  ...
</Sidebar>
```

- 実装コスト：低（既存 nav-items.ts を再構成するだけ）
- 操作性：高（全項目が常に見える）

### Option 2：折りたたみ式階層メニュー

```tsx
<Sidebar>
  <CollapsibleSidebarGroup label="取引先">
    <SidebarItem href="/clients">Clients</SidebarItem>
    ...
  </CollapsibleSidebarGroup>
  ...
</Sidebar>
```

- 実装コスト：中（折りたたみ UI、開閉状態の永続化）
- 操作性：マスターが 20 件超になったら有効

→ **Phase 1A 完了時点では Option 1 で十分**。Option 2 は Phase 2 以降に検討。

## 6. 実装タイミング

### 案 1：Phase 1A-14（CSV 一括）完了後に整備

メリット：

- Phase 1A のマスターが全部揃っているので、グルーピングが完成形で組める
- 後の追加（業務トランザクション）も同じパターンで足せる

デメリット：

- Phase 1A 完了直前なので、その後すぐ Phase 1B に進める誘惑がある

### 案 2：Phase 1B 着手時にナビゲーション再設計

メリット：

- 業務トランザクション追加と同時に再構成できる
- 業務トランザクションのグループも一緒に設計可能

デメリット：

- Phase 1B 着手まで時間が空く（その間ずっとフラット並びのまま）

### 推奨：案 1（Phase 1A-14 完了後）

理由：

- Phase 1A 完了の節目として整備するのが綺麗
- Phase 1A の動作確認 + ナビ整理 + master-patterns 改訂を 1 セットで実施できる
- Phase 1B 着手時の準備が整う

## 7. 関連ドキュメント

- `docs/phase1a-10-spec-confirmation-2026-05-27.md`：本構想の起点議論（4 ロール視点）
- `docs/shunya-master-patterns.md` v1.2：実装パターン集（ナビ追加のセクション参照）
- 仕様書 Part 3：5.7 ユーザー・権限管理（ロール別アクセス制御）

---

**判断時期**：Phase 1A-14（CSV 一括）完了後、Phase 1A 全体まとめの一環として実施。
