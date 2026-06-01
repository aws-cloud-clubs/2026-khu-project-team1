import { supabase } from '../lib/supabase'

export default function Header() {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
      <span className="text-lg font-semibold">Webhook Inspector</span>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-gray-800"
      >
        로그아웃
      </button>
    </header>
  )
}
