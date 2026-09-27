/**
 * B-205 PR-1（D-15・D-23・P1-D1・P1-D2）: company-issuer の純関数の検証（テストランナー非依存・DB 非接続）。
 * 手動実行: `npx tsx src/lib/company-issuer.test.ts`
 */

import {
  isBankAccount,
  issuerAddressLine,
  issuerTelFaxLine,
  joinFullWidth,
  labelFax,
  labelMail,
  labelPostal,
  labelTel,
  withLabel,
} from "./company-issuer"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

// ① 頭の文字を付ける。空は空文字。既に付いていれば付けない（D-23）
{
  assert(labelTel("03-5459-1177") === "TEL: 03-5459-1177", "① TEL を付ける")
  assert(labelTel("TEL: 03-5459-1177") === "TEL: 03-5459-1177", "①' 既に TEL: が付いていれば二重にしない")
  assert(labelTel("TEL:03-5459-1177") === "TEL:03-5459-1177", "①'' 空白なしの TEL: も付いている扱い")
  assert(labelTel("") === "" && labelTel(null) === "" && labelTel("  ") === "", "①''' 空は空文字（「TEL: 」だけを残さない）")
  assert(labelFax("03-5459-1181") === "FAX: 03-5459-1181" && labelMail("info@shunya.cc") === "MAIL: info@shunya.cc", "①'''' FAX / MAIL")
  assert(labelPostal("150-0043") === "〒150-0043" && labelPostal("〒150-0043") === "〒150-0043", "①''''' 〒（P1-D1）")
  assert(withLabel("TEL: ", " 03-1 ") === "TEL: 03-1", "①'''''' 前後の空白は落とす")
}

// ② 全角空白でつなぐ。空の部分は落とす
{
  assert(joinFullWidth("TEL: 1", "FAX: 2") === "TEL: 1　FAX: 2", "② 2 つ")
  assert(joinFullWidth("TEL: 1", "") === "TEL: 1" && joinFullWidth("", "", null) === "", "②' 空を落とす")
}

// ③ 住所の 1 行と TEL/FAX の 1 行
{
  assert(issuerAddressLine({ postalCode: "150-0043", address: "東京都渋谷区道玄坂1-22-10" }) === "〒150-0043 東京都渋谷区道玄坂1-22-10", "③ 〒＋住所")
  assert(issuerAddressLine({ postalCode: null, address: "東京都" }) === "東京都", "③' 〒が空なら住所だけ")
  assert(issuerAddressLine({ postalCode: "150-0043", address: null }) === "〒150-0043", "③'' 住所が空なら〒だけ")
  assert(issuerAddressLine({ postalCode: null, address: null }) === "", "③''' 両方空なら空文字")
  assert(issuerTelFaxLine({ phone: "03-1", fax: null }) === "TEL: 03-1", "③'''' FAX が空なら TEL だけ")
}

// ④ 振込先の判定（5 キーとも string のときだけ・P1-D2）
{
  const full = { bankName: "a", branchName: "b", accountType: "c", accountNumber: "d", accountHolder: "e" }
  assert(isBankAccount(full), "④ 5 キー揃い")
  assert(!isBankAccount({ ...full, accountHolder: undefined }), "④' 1 つ欠けると false")
  assert(!isBankAccount(null) && !isBankAccount("x") && !isBankAccount([]), "④'' null / 文字列 / 配列は false")
}

console.log("company-issuer.test.ts: all assertions passed")
