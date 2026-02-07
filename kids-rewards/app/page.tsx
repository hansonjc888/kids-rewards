import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12 text-center">
        <div className="text-6xl mb-6">🌟</div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Kids Rewards System
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Track achievements, earn stars, and celebrate success together!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="text-3xl mb-2">📝</div>
            <h3 className="font-semibold text-gray-900 mb-1">Submit</h3>
            <p className="text-sm text-gray-600">Kids share achievements via Telegram</p>
          </div>
          <div className="bg-green-50 rounded-lg p-6">
            <div className="text-3xl mb-2">✅</div>
            <h3 className="font-semibold text-gray-900 mb-1">Approve</h3>
            <p className="text-sm text-gray-600">Parents review and award stars</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-6">
            <div className="text-3xl mb-2">🏆</div>
            <h3 className="font-semibold text-gray-900 mb-1">Track</h3>
            <p className="text-sm text-gray-600">View progress and leaderboard</p>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="inline-block bg-blue-600 text-white font-semibold px-8 py-4 rounded-full hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
        >
          View Dashboard →
        </Link>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Telegram Bot: @hansonjc_assistant_bot</p>
          <div className="flex items-center justify-center space-x-4 text-xs text-gray-400">
            <span>✨ AI-powered stories</span>
            <span>•</span>
            <span>📸 Image support</span>
            <span>•</span>
            <span>🌍 Multilingual</span>
          </div>
        </div>
      </div>
    </div>
  );
}
