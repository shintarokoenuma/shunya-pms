# B-118: Windows Chrome で入力ボックスがフォーカス時に最下部へスクロールする（再発監視ノート）

- 起票日: 2026-08-07
- 状態: 未再現・監視中（修正パッチ未実施）
- 優先度: 中（再発時は業務停止級。現在は自然解消）
- 種別: 監視ノート（バックログ本体は SESSION_HANDOVER.md §⑦ に索引1行）

## 1. 事象

本番 `/purchase-orders/new?progressTaskId=...&sampleProductionId=...` で、
入力ボックスをクリックして文字を入力しようとするとページ最下部へスクロールが飛び、入力できない。

- 発生環境: Windows Chrome のみ。**Mac Chrome では発生せず**
- 対象: 明細セル・基本情報を問わず**全入力ボックス**
- 転帰: 同日中に環境側で自然解消。**コード変更・デプロイは一切していない**
  → 直った原因は当方の修正ではなく環境側。同条件が揃えば再発する前提で扱う。

## 2. 調査済み（2026-08-07 / Claude Code / dev = hopper:12921・本番非接続）

コード側候補は現物 grep で全て非該当:

| 候補 | 内容 | 判定 |
|---|---|---|
| A | form 内 button の type 欠落 → submit → RHF shouldFocusError | 非該当（Button は全て type="button"、submit は1つ、handleSubmit は :226 のみ） |
| B | 明細行が親 render 内定義／不安定 key で再マウント | 非該当（ItemRow はトップレベル関数・`key={f.id}` は RHF 安定 id） |
| C | scrollIntoView / scrollTo / hash 副作用 | 非該当（PO 経路になし） |
| D | 最下部要素の autoFocus | 非該当（PO 経路になし） |
| E | onChange での router 書換・useSearchParams | 非該当（router は submit 成功時のみ :207/:215） |
| F | Select / Popover / Command のフォーカス管理 | 兆候なし（SearchableSelect は Radix Popover Portal + cmdk の標準構成） |

Playwright 再現（dev・実 ID 使用）: **desktop 1280x800 / mobile 390x844 いずれも再現せず**。
全入力で `clickY === typeY`（入力による追加スクロールなし）・focus 保持・値入力成功。
click 時のスクロールは画面外入力を可視化する通常の scroll-into-view であり、
`clickY` は各フィールドの文書内 y 位置と一致（quantity/unit/unitPrice が最下部なのは元々そこにあるため）。

## 3. 最有力仮説（未確定）

`src/components/app-shell/app-shell.tsx:35` の `<main className="flex-1 overflow-auto">`。
window スクロールと入れ子スクロールコンテナの二重構成が、
Windows の表示スケーリング／スクロールバー幅とブラウザの focus-scroll（フォーカス時に
全スクロール祖先を可視化しに動く挙動）と噛み合った際の暴走。
headless Chromium はこの実機固有挙動を再現しないため自動検証では出ない。

**確定していないため、この仮説に基づくパッチは当てない。** `<main>` の overflow は
全画面共通レイアウトであり、原因未確定のまま触ると影響範囲だけ広がる。

## 4. 再発時に最優先で取る証拠

1. 画面録画（Windows: Win+Alt+R）
2. 下記 §5 の計測スニペット出力（最優先）
3. `chrome://version` の先頭行
4. Windows のディスプレイ解像度と表示スケーリング（%）
5. 切り分け: 他フォーム（品番カルテ編集等）でも起きるか／シークレットウィンドウで直るか／
   Ctrl+0 でズーム 100% にして直るか／IME オフ（半角英数）で直るか

## 5. 計測スニペット

再発した Windows Chrome で当該フォームを開き、DevTools Console に貼って Enter。
その後、各入力をクリックして数文字入力し、`[B-118]` 行を全部コピーする。

```js
// === B-118 Windows Chrome focus-scroll 計測 ===
(() => {
  const log = (...a) => console.log("[B-118]", ...a);

  log("ENV", {
    ua: navigator.userAgent,
    dpr: window.devicePixelRatio,
    innerW: innerWidth, innerH: innerHeight,
    scrollbarW: innerWidth - document.documentElement.clientWidth,
    vvScale: visualViewport?.scale ?? null,
    vvH: visualViewport ? Math.round(visualViewport.height) : null,
    docScrollH: document.documentElement.scrollHeight,
    zoom: Math.round((outerWidth / innerWidth) * 100) + "%(概算)",
  });

  const scrollables = (el) => {
    const out = []; let n = el;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll|overlay)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1)
        out.push(n);
      n = n.parentElement;
    }
    return out;
  };
  const snap = (el) => ({
    winY: window.scrollY,
    anc: scrollables(el).map(a => ({
      tag: a.tagName.toLowerCase(),
      cls: (a.className || "").toString().slice(0, 48),
      scrollTop: a.scrollTop,
      overflowY: getComputedStyle(a).overflowY,
    })),
  });

  const inputs = document.querySelectorAll("form input, form textarea");
  log("計測対象 inputs:", inputs.length);
  inputs.forEach((el) => {
    el.addEventListener("focus", () => {
      const name = el.getAttribute("name") || el.id || el.type;
      const before = snap(el);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const after = snap(el), r = el.getBoundingClientRect();
        log("FOCUS", name,
          "| winY", before.winY, "→", after.winY,
          "| rectTop", Math.round(r.top),
          "| ancestors", after.anc);
      }));
    }, true);
  });
  log("仕込み完了。各入力をクリック→数文字入力し、[B-118] FOCUS 行を全部コピーしてください。");
})();
```

## 6. 判定表（上記ログから結論を出す）

| 観測 | 結論 |
|---|---|
| `ancestors[].scrollTop` が跳ね上がる（`winY` は不変） | 犯人は `<main overflow-auto>`（入れ子容器）＝仮説的中。修正は `<main>` の単一スクローラ化 or focus 時 preventScroll |
| `winY` だけ最下部へ跳ぶ（ancestors 変化なし） | window スクロールの暴走。scroll-behavior / レイアウトシフト側 |
| `scrollbarW > 0`（Mac は 0＝オーバーレイ）かつ `dpr ≠ 1` のときだけ発生 | Windows のスクロールバー幅 × 表示スケーリングが引き金。Mac 非再発の説明がつく |
| `rectTop` が毎回ほぼ同じなのに `winY` が最大値 | ブラウザの過剰 scroll-into-view ＝入れ子容器の高さ計算ズレ |

このログが取れるまで修正には進まない。

## 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-08-07 | 初版。事象・調査結果（候補A〜F 非該当・Playwright 非再現）・仮説・計測スニペット・判定表 |

## 7. 追加観測（2026-08-07 昼・2回目の発生）

- PO 発注ページで再発。**Windows Chrome のみ**という条件は初回と同じ。
- **再読み込みと思われる操作で解消した。**
  → 静的レイアウト問題ではなく「ページのライフサイクル中に発生する状態」の可能性が高い。
  §3 の `<main overflow-auto>` 静的要因説は**格下げ**。
  遷移経路依存（スクロール位置復元／Next.js ソフトナビゲーション／
  遅延ロードによるレイアウトシフト）を**新たな第一候補**とする。
- 計測ログは2回とも取得できず（発生中に §5 スニペットを貼る前に解消）。

### 次回再発時の優先順位（F5 する前に）

1. **§5 の計測スニペットを Console に貼る（最優先）。** 再読み込みすると証拠が消える。
2. スニペットが間に合わない場合でも、最低限これを記録する:
   - **そのページへ来た遷移経路**（サイドバー→発注一覧→新規作成／進行チェックリストの
     「発注を作成」ボタン／URL 直打ち／ブラウザの戻る、等）
   - 直前に何をしていたか
3. 検証: F5 の前に**同じ URL を直打ちで開き直す**。それで直れば
   「遷移経路が引き金」が確定する。
