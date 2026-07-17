import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { scholarApi } from '@/api/endpoints/scholar'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { 
  GraduationCap, 
  Globe, 
  BarChart3, 
  Database, 
  GitMerge, 
  FolderHeart,
  Users,
  FileText, 
  Calendar,
  Play,
  ShieldCheck,
  CheckCircle2,
  Briefcase
} from 'lucide-react'

export function DashboardPage() {
  const navigate = useNavigate()
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['scholarStats'],
    queryFn: () => scholarApi.getStats().then((r) => r.data),
    refetchInterval: 15000
  })

  // 6 tools unified under the brand deep blue color scheme #005B9A
  const tools = [
    {
      id: 1,
      title: 'Scholar Scraper & Matcher',
      desc: 'Cào dữ liệu Google Scholar và đối khớp với CSDL phân hạng (IF, SJR, WoS Core).',
      badge: 'CORE',
      db: 'saved_profiles.db',
      numBg: 'bg-[#e6f0f7] text-[#005b9a] border border-[#b8d4e9]',
      iconColor: 'text-[#005b9a]',
      iconBg: 'bg-[#e6f0f7]',
      dbColor: 'text-[#005b9a]',
      icon: GraduationCap,
      path: '/scholar/scraper'
    },
    {
      id: 2,
      title: 'BioxBio Crawler (IF)',
      desc: 'Cào dữ liệu Impact Factor từ BioxBio.com và tạo cơ sở dữ liệu bioxbio_all.db.',
      badge: null,
      db: 'bioxbio_all.db',
      numBg: 'bg-[#e6f0f7] text-[#005b9a] border border-[#b8d4e9]',
      iconColor: 'text-[#005b9a]',
      iconBg: 'bg-[#e6f0f7]',
      dbColor: 'text-[#005b9a]',
      icon: Globe,
      path: '/scholar/bioxbio'
    },
    {
      id: 3,
      title: 'SCImago Crawler (SJR)',
      desc: 'Tải và xử lý dữ liệu SJR từ SCImagoJR.com và tạo cơ sở dữ liệu scimagojr_all.db.',
      badge: null,
      db: 'scimagojr_all.db',
      numBg: 'bg-[#e6f0f7] text-[#005b9a] border border-[#b8d4e9]',
      iconColor: 'text-[#005b9a]',
      iconBg: 'bg-[#e6f0f7]',
      dbColor: 'text-[#005b9a]',
      icon: BarChart3,
      path: '/scholar/scimago'
    },
    {
      id: 4,
      title: 'Clarivate Crawler (WoS Core)',
      desc: 'Cào dữ liệu danh mục Web of Science Core Collection từ Clarivate Master Journal.',
      badge: null,
      db: 'clarivate_all.db',
      numBg: 'bg-[#e6f0f7] text-[#005b9a] border border-[#b8d4e9]',
      iconColor: 'text-[#005b9a]',
      iconBg: 'bg-[#e6f0f7]',
      dbColor: 'text-[#005b9a]',
      icon: Database,
      path: '/scholar/clarivate'
    },
    {
      id: 5,
      title: 'Score Integrator (Mapping DB)',
      desc: 'Đồng bộ và tích hợp IF + SJR + WoS Core để tạo cơ sở dữ liệu mapping cuối cùng.',
      badge: null,
      db: 'clarivate_mapped.db',
      numBg: 'bg-[#e6f0f7] text-[#005b9a] border border-[#b8d4e9]',
      iconColor: 'text-[#005b9a]',
      iconBg: 'bg-[#e6f0f7]',
      dbColor: 'text-[#005b9a]',
      icon: GitMerge,
      path: '/scholar/integrator'
    },
    {
      id: 6,
      title: 'Profile Manager (Offline)',
      desc: 'Quản lý hồ sơ tác giả đã lưu, xem chi tiết và xuất báo cáo offline.',
      badge: null,
      db: 'saved_profiles.db',
      numBg: 'bg-[#e6f0f7] text-[#005b9a] border border-[#b8d4e9]',
      iconColor: 'text-[#005b9a]',
      iconBg: 'bg-[#e6f0f7]',
      dbColor: 'text-[#005b9a]',
      icon: FolderHeart,
      path: '/scholar/profiles'
    }
  ]

  const formattedDate = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
  
  const formattedTime = new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  })

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Spinner className="h-8 w-8 text-sky-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto -mt-2">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div></div>
        
        {/* Top Header stats row - 4 separate cards enwrapped in brand color #005B9A */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-4">
          {/* Card 1: 6 Công cụ */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-3xs min-w-[130px]">
            <Briefcase className="h-5 w-5 text-[#005b9a] shrink-0" />
            <div className="leading-tight">
              <span className="text-[14px] font-bold text-slate-800 block">6</span>
              <span className="text-[9px] text-slate-400 font-bold block mt-0.5 leading-none">Công cụ</span>
            </div>
          </div>
          
          {/* Card 2: 6 CSDL */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-3xs min-w-[130px]">
            <Database className="h-5 w-5 text-[#005b9a] shrink-0" />
            <div className="leading-tight">
              <span className="text-[14px] font-bold text-slate-800 block">6</span>
              <span className="text-[9px] text-slate-400 font-bold block mt-0.5 leading-none">CSDL</span>
            </div>
          </div>

          {/* Card 3: Hồ sơ đã lưu */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-3xs min-w-[130px]">
            <Users className="h-5 w-5 text-[#005b9a] shrink-0" />
            <div className="leading-tight">
              <span className="text-[14px] font-bold text-slate-800 block">{stats?.authors || 0}</span>
              <span className="text-[9px] text-slate-400 font-bold block mt-0.5 leading-none">Hồ sơ đã lưu</span>
            </div>
          </div>

          {/* Card 4: Date/Time */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-3xs min-w-[150px]">
            <Calendar className="h-5 w-5 text-[#005b9a] shrink-0" />
            <div className="leading-tight">
              <span className="text-[11px] font-bold text-slate-800 block">{formattedDate}</span>
              <span className="text-[8px] text-slate-400 font-bold block mt-0.5 leading-none">{formattedTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid of 6 Tools enwrapped in a parent sturdy border card - Compact design */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
          TỔNG QUAN 6 CÔNG CỤ CHÍNH
        </h2>
        
        <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => {
            const Icon = t.icon
            return (
              <Card key={t.id} className="flex flex-col border border-slate-200 hover:border-slate-300 bg-white rounded-xl shadow-3xs transition-colors">
                <CardContent className="flex flex-1 flex-col p-3.5">
                  
                  {/* Top line: Number badge and Icon container */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 ${t.numBg} rounded-md flex items-center justify-center font-bold text-[10px]`}>
                        {t.id}
                      </span>
                      <div className={`w-7.5 h-7.5 ${t.iconBg} ${t.iconColor} rounded-lg flex items-center justify-center`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                    </div>

                    {t.badge && (
                      <span className="bg-[#005b9a] text-white rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider">
                        {t.badge}
                      </span>
                    )}
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-xs font-bold text-slate-800 leading-tight mb-1">
                    {t.title}
                  </h3>

                  {/* Description - line clamped to prevent vertical growth */}
                  <p className="text-[10px] text-slate-400 leading-relaxed mb-3 line-clamp-2 h-7.5">
                    {t.desc}
                  </p>

                  {/* Database mapping & ready status */}
                  <div className="mt-auto space-y-2">
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                      <span className={`flex items-center gap-1 font-mono text-[9px] font-bold ${t.dbColor}`}>
                        <Database className="w-3 h-3" />
                        {t.db}
                      </span>
                      
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 border border-emerald-100">
                        <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                        Sẵn sàng
                      </span>
                    </div>

                    {/* Open Tool Button */}
                    <button
                      onClick={() => navigate(t.path)}
                      className="w-full flex items-center justify-center gap-1 rounded-lg py-1.5 bg-[#005b9a] hover:bg-[#004677] text-white font-bold text-[10px] shadow-3xs transition-colors cursor-pointer"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Mở công cụ</span>
                    </button>
                  </div>
                  
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Stats wrapper nested in border card - Compact design */}
      <div className="grid gap-4 lg:grid-cols-9">
        {/* Quick statistics enwrapped in outer border container */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs lg:col-span-4 flex flex-col justify-between">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
            THỐNG KÊ NHANH
          </h2>
          
          <div className="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-4">
            {[
              { label: 'Hồ sơ tác giả', val: stats?.authors || 0, icon: FileText, iconColor: 'text-[#005b9a]', valColor: 'text-[#005b9a]' },
              { label: 'Bài báo đã lưu', val: (stats?.publications || 0).toLocaleString(), icon: FileText, iconColor: 'text-emerald-600', valColor: 'text-emerald-600' },
              { label: 'Tỷ lệ đối khớp', val: `${stats?.match_rate || 0}%`, icon: ShieldCheck, iconColor: 'text-[#005b9a]', valColor: 'text-[#005b9a]' },
              { label: 'Tạp chí trong DB', val: (stats?.mapped_journals || 0).toLocaleString(), icon: BarChart3, iconColor: 'text-[#005b9a]', valColor: 'text-[#005b9a]' },
            ].map((st, i) => {
              const Icon = st.icon
              return (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white shadow-3xs flex-1">
                  <Icon className={`w-6 h-6 ${st.iconColor} shrink-0`} />
                  <div className="leading-tight">
                    <span className={`text-[12px] font-bold ${st.valColor} block`}>{st.val}</span>
                    <span className="text-[8px] font-semibold text-slate-400 block mt-0.5 leading-none">{st.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Database files status enwrapped in outer border container */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs lg:col-span-5 flex flex-col justify-between">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
            TRẠNG THÁI CƠ SỞ DỮ LIỆU
          </h2>
          
          <div className="grid gap-2 grid-cols-3 md:grid-cols-5 lg:grid-cols-5">
            {[
              { name: 'bioxbio_all.db', count: stats?.bioxbio_journals || 0 },
              { name: 'scimagojr_all.db', count: stats?.scimago_journals || 0 },
              { name: 'clarivate_all.db', count: stats?.clarivate_journals || 0 },
              { name: 'clarivate_mapped.db', count: stats?.mapped_journals || 0 },
              { name: 'saved_profiles.db', count: stats?.authors || 0 },
            ].map((db, i) => (
              <div key={i} className="flex flex-col justify-between p-2 rounded-lg border border-slate-200 bg-white shadow-3xs">
                <span className="font-mono text-[8px] font-bold text-slate-400 truncate" title={db.name}>{db.name}</span>
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 fill-emerald-50 shrink-0" />
                  <span className="text-[11px] font-bold text-[#005b9a] font-mono leading-none">{db.count.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
    </div>
  )
}
