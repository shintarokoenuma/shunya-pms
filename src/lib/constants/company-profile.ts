/**
 * B-205 PR-1（spec v1.0 D-2）: 自社情報はテナントごとに Company（DB）に持つ。
 * 以前ここにあった全テナント共通の固定値（定数の自社情報）は廃止した。
 * 帳票の自社情報は src/lib/company-issuer.ts の getCompanyIssuer で読む。設定は /settings/company・/settings/bank。
 * 型 CompanyBankAccount だけをここに残す（Invoice.bankInfo / Company.bankAccount の Json の形・5 キー）。
 */
export type CompanyBankAccount = {
  bankName: string
  branchName: string
  accountType: string
  accountNumber: string
  accountHolder: string
}
