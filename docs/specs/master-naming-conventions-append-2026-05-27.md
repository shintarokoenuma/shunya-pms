
---

## DeliveryDestination マスターの destinationCode 命名規則

（2026-05-27 追記、Phase 1A-10 仕様確定議論より）

DeliveryDestination は Buyer の物理拠点（店舗・倉庫・物流センター等）。
基本パターンは `<buyerCode>-<location>` 形式。強制ではなく推奨（DB 制約は `@@unique([companyId, destinationCode])` のみ）。

### 標準パターン：`<buyerCode>-<location>`

| Buyer | DD | destinationCode |
|---|---|---|
| BEAMS-DOM | 渋谷店 | `BEAMS-DOM-SHIBUYA` |
| BEAMS-DOM | 原宿店 | `BEAMS-DOM-HARAJUKU` |
| BEAMS-DOM | 新宿店 | `BEAMS-DOM-SHINJUKU` |
| BEAMS-INTL | LA 店 | `BEAMS-INTL-LA` |
| BEAMS-PB | 倉庫 1 | `BEAMS-PB-WH01` |
| ALPHA（Case A 型 Buyer）| 直営店 | `ALPHA-FLAGSHIP` |
| ALPHA | 表参道店 | `ALPHA-OMOTESANDO` |
| MARKA-BEAMS | 渋谷店 | `MARKA-BEAMS-SHIBUYA` |

### location 部分の付け方の目安

| 種別 | 略号パターン | 例 |
|---|---|---|
| 国内店舗 | 区市町村 or 都市の英字略号 | `SHIBUYA / HARAJUKU / SHINJUKU / GINZA / OSAKA / NAGOYA` |
| 海外店舗 | 都市略号（IATA 3 文字コードでも可）| `LA / NYC / PARIS / SEOUL / TYO` |
| フラッグシップ | `FLAGSHIP` | `ALPHA-FLAGSHIP` |
| 倉庫 | `WH` + 連番 | `WH01 / WH02` |
| 物流センター | `DC` + 識別子（Distribution Center）| `DC-NARITA / DC01` |
| 配送センター | `LC` + 識別子（Logistics Center）| `LC-CHIBA` |
| ポップアップ | `POP-` + 地名 | `POP-OMOTESANDO` |

### 略号の付け方ルール

- 大文字英数字 + ハイフン
- 最大 50 文字（schema 制約：`@db.VarChar(50)`）
- buyerCode をプレフィックスにすることで一意性を自然に担保
- ハイフンが重なる視認的混乱は問題なし（`BEAMS-DOM-SHIBUYA` でトークン構造が明瞭）

### Brand との関係

destinationCode には Brand 情報は混ぜない。理由：

- 1 つの DD で複数 Brand の商品を受け入れるケースがある（BEAMS渋谷店で ALPHA も BETA も受け取る）
- Brand は商品 identity、DD は物理拠点、レイヤーが違う
- buyerCode に Brand 情報が必要なら、それは buyerCode の命名で対応済み（Phase 1A-11）

destinationCode は「どの Buyer のどの物理拠点か」だけを表現。Brand とは独立。

### 例外パターン

業務上の都合で標準パターンから外れる場合：

| ケース | destinationCode 例 |
|---|---|
| Buyer 紐付きが薄い拠点 | `BEAMS-CENTRAL-WH` |
| 複数 Buyer 共用倉庫 | `JOINT-WH-NARITA` |
| 一時的なポップアップ拠点 | `BEAMS-POP-OMOTESANDO` |

詳細な議論経緯は `docs/phase1a-10-spec-confirmation-2026-05-27.md` を参照。
