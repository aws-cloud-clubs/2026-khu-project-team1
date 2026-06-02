import Header from '../components/Header'
import WebhookUrlCard from '../components/WebhookUrlCard'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <WebhookUrlCard />
      </main>
    </div>
  )
}
