import { useState } from 'react'
import { ShieldAlert, Mail } from 'lucide-react'
import { AntiBlockSettingsCard } from '@/components/scholar/AntiBlockSettingsCard'
import { EmailSettingsCard } from '@/components/scholar/EmailSettingsCard'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'CRAWLER' | 'EMAIL'>('CRAWLER')

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Sub-Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold text-slate-500">
        <button
          onClick={() => setActiveTab('CRAWLER')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'CRAWLER'
              ? 'border-[#005b9a] text-[#005b9a]'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Cấu hình Crawler & Anti-Block
        </button>

        <button
          onClick={() => setActiveTab('EMAIL')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'EMAIL'
              ? 'border-[#005b9a] text-[#005b9a]'
              : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Mail className="w-4 h-4" />
          Cấu hình Dịch vụ Email (SMTP)
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'CRAWLER' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-12">
            <AntiBlockSettingsCard />
          </div>
        </div>
      )}

      {activeTab === 'EMAIL' && (
        <div className="max-w-4xl">
          <EmailSettingsCard />
        </div>
      )}
    </div>
  )
}
