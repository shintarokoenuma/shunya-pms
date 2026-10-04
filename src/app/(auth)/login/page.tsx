import { LoginForm } from "./login-form"

type SearchParams = Promise<{ invited?: string; reset?: string; passwordChanged?: string }>

/**
 * B-205 PR-3（§4-6）: ログイン画面。?invited=1 / ?reset=1 のときは上に文を出す。
 * B-244（D-5）: ?passwordChanged=1（プロフィールでパスワードを変えてサインアウトした後）も同じ文
 * フォーム本体は login-form.tsx（client）。searchParams をここで読むのは、client の useSearchParams に Suspense が要るのを避けるため
 */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const notice =
    sp.invited === "1"
      ? "パスワードを決めました。ログインしてください。"
      : sp.reset === "1" || sp.passwordChanged === "1"
        ? "パスワードを変更しました。新しいパスワードでログインしてください。"
        : null
  return <LoginForm notice={notice} />
}
