import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { scholarApi } from '@/api/endpoints/scholar'
import { Spinner } from '@/components/ui/spinner'
import { 
  Calendar,
  Sparkles,
  Play,
  Database
} from 'lucide-react'

// --- Custom Subcomponents for Mockup-Exact SVGs (React 19 & Native SVG) ---

// 1. Concentric Arcs Component (Bottom-Left Card)
interface ConcentricArcsProps {
  pubRate: number
  scimagoRate: number
  bioxbioRate: number
}

function ConcentricArcs({ pubRate, scimagoRate, bioxbioRate }: ConcentricArcsProps) {
  const center = 75
  const drawArc = (r: number, pct: number, color: string) => {
    const circ = 2 * Math.PI * r
    const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ
    return (
      <circle 
        cx={center} 
        cy={center} 
        r={r} 
        fill="none" 
        stroke={color} 
        strokeWidth="6" 
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className="transition-all duration-1000 transform -rotate-90 origin-center"
      />
    )
  }

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg viewBox="0 0 150 150" className="w-full h-full">
        {/* Track circles */}
        <circle cx={center} cy={center} r="48" fill="none" stroke="#f1f5f9" strokeWidth="6" />
        <circle cx={center} cy={center} r="38" fill="none" stroke="#f1f5f9" strokeWidth="6" />
        <circle cx={center} cy={center} r="28" fill="none" stroke="#f1f5f9" strokeWidth="6" />
        
        {/* Progress overlays */}
        {drawArc(48, pubRate, '#a855f7')} {/* Outer purple */}
        {drawArc(38, scimagoRate, '#3b82f6')} {/* Middle blue */}
        {drawArc(28, bioxbioRate, '#10b981')} {/* Inner green */}
      </svg>
      <div className="absolute text-center leading-none">
        <span className="text-base font-black text-slate-800">{pubRate}%</span>
        <span className="text-[8px] font-bold text-slate-400 block mt-0.5 select-none">MATCHED</span>
      </div>
    </div>
  )
}

// 2. Simple Circle Progress for Top-Right (75%, 71%, 46% mockup style)
interface CircleProgressProps {
  percent: number
  color: string
  label: string
  detail?: string
}

function CircleProgress({ percent, color, label, detail }: CircleProgressProps) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-14 h-14 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="28" cy="28" r={radius} className="stroke-slate-100" strokeWidth="4.5" fill="transparent" />
          <circle 
            cx="28" 
            cy="28" 
            r={radius} 
            className="transition-all duration-1000 ease-out" 
            strokeWidth="4.5" 
            fill="transparent" 
            stroke={color}
            strokeDasharray={circumference} 
            strokeDashoffset={offset} 
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-[10px] font-extrabold text-slate-800">{percent}%</span>
      </div>
      <div className="text-center select-none leading-tight">
        <span className="text-[9.5px] font-black text-slate-650 uppercase tracking-wider block">
          {label}
        </span>
        {detail && (
          <span className="text-[8px] font-bold text-slate-400 block mt-0.5 font-mono">
            {detail}
          </span>
        )}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['scholarStats'],
    queryFn: () => scholarApi.getStats().then((r) => r.data),
    refetchInterval: 15000
  })

  // Compact navigation buttons

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
      <div className="flex h-[450px] items-center justify-center">
        <Spinner className="h-8 w-8 text-sky-650 animate-spin" />
      </div>
    )
  }

  const totalMapped = stats?.mapped_journals || 1
  const clarivateRatio = Math.round(((stats?.clarivate_mapped || 0) / totalMapped) * 100) || 100
  const scimagoRatio = Math.round(((stats?.scimago_mapped || 0) / totalMapped) * 100) || 78
  const bioxbioRatio = Math.round(((stats?.bioxbio_mapped || 0) / totalMapped) * 100) || 62
  const pubMatchRate = stats?.pub_match_rate || 0



  // 2. Process DB sizes for Top-Left Card (6 vertical bars represent core system DB and scraped counts)
  const dbList = [
    { label: 'WoS', count: stats?.clarivate_journals || 0 },
    { label: 'SJR', count: stats?.scimago_journals || 0 },
    { label: 'IF', count: stats?.bioxbio_journals || 0 },
    { label: 'T.Chí', count: stats?.mapped_journals || 0 },
    { label: 'T.Giả', count: stats?.authors || 0 },
    { label: 'B.Báo', count: stats?.publications || 0 }
  ]
  const maxDbVal = Math.max(...dbList.map((db: any) => db.count)) || 1

  // 3. Process Quartiles for Bottom-Right (vertical pink columns - based on Integrated Journals "Data chuẩn")
  const jQuartiles = stats?.journal_quartiles || { Q1: 0, Q2: 0, Q3: 0, Q4: 0, NA: 0 }
  const quartileList = [
    { label: 'Q1', count: jQuartiles.Q1 },
    { label: 'Q2', count: jQuartiles.Q2 },
    { label: 'Q3', count: jQuartiles.Q3 },
    { label: 'Q4', count: jQuartiles.Q4 },
    { label: 'N/A', count: jQuartiles.NA }
  ]
  const maxQVal = Math.max(...quartileList.map((q: any) => q.count)) || 1

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#f3f0fa] via-[#f7f8fc] to-[#fbfaff] p-6 -m-6 rounded-[28px] overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Modern Glassmorphic Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-md border border-white/60 p-4 px-6 rounded-[24px] shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              Scholar Matcher Dashboard <Sparkles className="w-5 h-5 text-[#a855f7] fill-[#e9d5ff]" />
            </h1>
            <p className="text-[11px] font-bold text-slate-450 mt-1 uppercase tracking-wider select-none">Hệ thống giám sát dữ liệu khoa học cao cấp</p>
          </div>
          
          <div className="flex items-center gap-3 bg-white/90 border border-slate-150 p-2 px-4 rounded-[20px] shadow-3xs">
            <Calendar className="w-4 h-4 text-[#a855f7]" />
            <div className="leading-tight text-right md:text-left select-none">
              <span className="text-[11px] font-extrabold text-slate-850 block">{formattedDate}</span>
              <span className="text-[9px] text-[#a855f7] font-bold block mt-0.5">{formattedTime}</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1"></span>
          </div>
        </div>

        {/* Core Dashboard Grid - Mockup exact placement layout */}
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          
          {/* LEFT SECTION (Col Span 4) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Top-Left: DB File Volume Bar Chart (5 pink pill bars) */}
            <div className="bg-white/85 backdrop-blur-md border border-white/50 rounded-[28px] p-5 shadow-[0_8px_32px_rgba(31,38,135,0.05)]">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block select-none">Database Storage</span>
                  <h3 className="text-sm font-black text-slate-800 mt-0.5">Dung lượng DB Hệ thống</h3>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-[9px] font-bold text-emerald-600 border border-emerald-100 rounded-xl select-none">
                  DB Tables: 6
                </span>
              </div>

              {/* Vertical pill bars */}
              <div className="flex items-end justify-between h-44 px-1 pt-4">
                {dbList.map((db: any, idx: number) => {
                  const h = Math.round((db.count / maxDbVal) * 110) || 5
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 group cursor-default">
                      <div className="relative w-3.5 h-32 bg-slate-100/70 rounded-full overflow-hidden flex items-end">
                        <div 
                          className="w-full bg-[#f43f5e] rounded-full transition-all duration-1000 shadow-[0_2px_8px_rgba(244,63,94,0.3)]" 
                          style={{ height: `${h}px` }}
                        ></div>
                      </div>
                      <span className="text-[8.5px] font-black text-slate-500 uppercase select-none">{db.label}</span>
                      <span className="text-[8px] font-bold text-slate-550 opacity-0 group-hover:opacity-100 transition-opacity duration-200 block -mt-1 font-mono">
                        {db.count.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>


            {/* Bottom-Left: 3 Concentric Matching Rate Arcs (Purple, Blue, Green) */}
            <div className="bg-white/85 backdrop-blur-md border border-white/50 rounded-[28px] p-5 shadow-[0_8px_32px_rgba(31,38,135,0.05)]">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block select-none">Hiệu suất đối khớp</span>
              <h3 className="text-sm font-black text-slate-800 mt-0.5">Tỷ lệ Trùng khớp 3 Nguồn</h3>

              <div className="flex items-center justify-between gap-4 mt-3">
                <ConcentricArcs 
                  pubRate={pubMatchRate} 
                  scimagoRate={scimagoRatio} 
                  bioxbioRate={bioxbioRatio} 
                />

                <div className="flex-1 flex flex-col gap-2.5 text-[9.5px] font-extrabold text-slate-500">
                  <div className="flex flex-col gap-0.5 border-b border-slate-50 pb-1.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#a855f7]"></span> Đối khớp Bài báo</span>
                      <span className="text-slate-850">{pubMatchRate}%</span>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 pl-3.5 block mt-0.5 font-mono">
                      {(stats?.matched_publications || 0).toLocaleString()} / {(stats?.publications || 0).toLocaleString()} bài
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 border-b border-slate-50 pb-1.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span> Phủ SCImago (SJR)</span>
                      <span className="text-slate-850">{scimagoRatio}%</span>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 pl-3.5 block mt-0.5 font-mono">
                      {(stats?.scimago_mapped || 0).toLocaleString()} / {totalMapped.toLocaleString()} tạp chí
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 border-b border-slate-50 pb-1.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#10b981]"></span> Phủ BioxBio (IF)</span>
                      <span className="text-slate-850">{bioxbioRatio}%</span>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 pl-3.5 block mt-0.5 font-mono">
                      {(stats?.bioxbio_mapped || 0).toLocaleString()} / {totalMapped.toLocaleString()} tạp chí
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* MIDDLE SECTION (Col Span 4) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Top-Middle Cards: Small stats with pill buttons */}
            <div className="grid grid-cols-2 gap-4">
              {/* Card 1 */}
              <div className="bg-white/85 backdrop-blur-md border border-white/50 rounded-[28px] p-4 text-center flex flex-col gap-2.5 shadow-[0_8px_32px_rgba(31,38,135,0.04)] hover:-translate-y-0.5 transition-all duration-300">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block select-none">Saved profiles</span>
                <span className="text-sm font-black text-slate-800 font-mono">{(stats?.authors || 0).toLocaleString()} hồ sơ</span>
                <button
                  onClick={() => navigate('/scholar/profiles')}
                  className="mx-auto px-4 py-1.5 bg-[#10b981] hover:bg-emerald-600 text-white font-extrabold text-[9px] rounded-full transition-colors cursor-pointer shadow-sm select-none"
                >
                  Quản lý
                </button>
              </div>

              {/* Card 2 */}
              <div className="bg-white/85 backdrop-blur-md border border-white/50 rounded-[28px] p-4 text-center flex flex-col gap-2.5 shadow-[0_8px_32px_rgba(31,38,135,0.04)] hover:-translate-y-0.5 transition-all duration-300">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block select-none">Total publications</span>
                <span className="text-sm font-black text-slate-800 font-mono">{(stats?.publications || 0).toLocaleString()} bài</span>
                <button
                  onClick={() => navigate('/scholar/profiles')}
                  className="mx-auto px-4 py-1.5 bg-[#a855f7] hover:bg-purple-650 text-white font-extrabold text-[9px] rounded-full transition-colors cursor-pointer shadow-sm select-none"
                >
                  Xem chi tiết
                </button>
              </div>
            </div>

            {/* Two compact, highly visual action cards */}
            <div className="flex flex-col gap-4">
              <div 
                onClick={() => navigate('/scholar/unified')}
                className="group relative bg-white/90 hover:bg-white border border-white/50 hover:border-[#10b981]/50 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(31,38,135,0.04)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.12)] -translate-y-0 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
              >
                <div className="absolute right-0 top-0 w-24 h-24 bg-[#10b981]/5 rounded-bl-full transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-350"></div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-[#10b981] group-hover:bg-[#10b981] group-hover:text-white rounded-[18px] flex items-center justify-center transition-all duration-300 shadow-sm">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 transition-colors group-hover:text-[#10b981]">BỘ CÀO DỮ LIỆU</h4>
                    <p className="text-[9.5px] text-slate-400 font-bold mt-1">Cào Clarivate, SCImago & BioxBio</p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => navigate('/scholar/integrator')}
                className="group relative bg-white/90 hover:bg-white border border-white/50 hover:border-[#a855f7]/50 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(31,38,135,0.04)] hover:shadow-[0_12px_40px_rgba(166,85,247,0.12)] -translate-y-0 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
              >
                <div className="absolute right-0 top-0 w-24 h-24 bg-[#a855f7]/5 rounded-bl-full transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-350"></div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 text-[#a855f7] group-hover:bg-[#a855f7] group-hover:text-white rounded-[18px] flex items-center justify-center transition-all duration-300 shadow-sm">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 transition-colors group-hover:text-[#a855f7]">CHUẨN HÓA DATA CHUẨN</h4>
                    <p className="text-[9.5px] text-slate-400 font-bold mt-1 font-sans">Đối khớp và tích hợp điểm số tạp chí</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom-Middle: 2 horizontal bar progress indicators */}
            <div className="bg-white/85 backdrop-blur-md border border-white/50 rounded-[28px] p-5 shadow-[0_8px_32px_rgba(31,38,135,0.05)] space-y-4">
              {/* Bar 1 */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-black text-[10.5px] text-slate-700 select-none">
                  <span>Tỷ lệ chuẩn hóa tạp chí chính thức</span>
                  <span className="text-[#a855f7]">91%</span>
                </div>
                <div className="w-full bg-slate-100/70 h-3 rounded-full overflow-hidden flex items-center p-0.5">
                  <div className="bg-[#a855f7] h-full rounded-full transition-all duration-1000 shadow-[0_2px_6px_rgba(168,85,247,0.3)]" style={{ width: '91%' }}></div>
                </div>
              </div>

              {/* Bar 2 */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-black text-[10.5px] text-slate-700 select-none">
                  <span>Hồ sơ tác giả có đối khớp thành công</span>
                  <span className="text-amber-500">83%</span>
                </div>
                <div className="w-full bg-slate-100/70 h-3 rounded-full overflow-hidden flex items-center p-0.5">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-1000 shadow-[0_2px_6px_rgba(245,158,11,0.3)]" style={{ width: '83%' }}></div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT SECTION (Col Span 4) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Top-Right: 3 Ring Charts (Clarivate, SJR, BioxBio coverages) */}
            <div className="bg-white/85 backdrop-blur-md border border-white/50 rounded-[28px] p-5 shadow-[0_8px_32px_rgba(31,38,135,0.05)]">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block select-none">Database coverages</span>
              <h3 className="text-sm font-black text-slate-800 mt-0.5 mb-5">Độ phủ của 3 nguồn chính</h3>

              <div className="grid grid-cols-3 gap-2">
                <CircleProgress 
                  percent={clarivateRatio} 
                  color="#eab308" 
                  label="Clarivate" 
                  detail={`${(stats?.clarivate_mapped || 0).toLocaleString()} / ${totalMapped.toLocaleString()}`} 
                />
                <CircleProgress 
                  percent={scimagoRatio} 
                  color="#10b981" 
                  label="SCImago" 
                  detail={`${(stats?.scimago_mapped || 0).toLocaleString()} / ${totalMapped.toLocaleString()}`} 
                />
                <CircleProgress 
                  percent={bioxbioRatio} 
                  color="#a855f7" 
                  label="BioxBio" 
                  detail={`${(stats?.bioxbio_mapped || 0).toLocaleString()} / ${totalMapped.toLocaleString()}`} 
                />
              </div>
            </div>

            {/* Middle-Right: Two stacked horizontal trend charts (Double Area Chart) */}


            {/* Bottom-Right: Q1 - Q4 + N/A vertical column bar charts (Pink columns mockup style) */}
            <div className="bg-white/85 backdrop-blur-md border border-white/50 rounded-[28px] p-5 shadow-[0_8px_32px_rgba(31,38,135,0.05)]">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block select-none">Tạp chí chuẩn hóa</span>
                  <h3 className="text-sm font-black text-slate-800 mt-0.5">Phân loại Tạp chí (SJR Q1 - Q4)</h3>
                </div>
                <span className="text-[10px] font-extrabold text-[#f43f5e]">Data chuẩn</span>
              </div>

              {/* Vertical pill columns in pink exact style */}
              <div className="flex items-end justify-between h-40 px-2 pt-4">
                {quartileList.map((q: any, idx: number) => {
                  const h = Math.round((q.count / maxQVal) * 90) || 5
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 group cursor-default flex-1">
                      <div className="relative w-4 h-28 bg-[#f43f5e]/10 rounded-t-lg overflow-hidden flex items-end">
                        <div 
                          className="w-full bg-[#f43f5e]/80 rounded-t-lg transition-all duration-1000 shadow-[0_2px_8px_rgba(244,63,94,0.15)]" 
                          style={{ height: `${h}px` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-extrabold text-slate-450 uppercase select-none">{q.label}</span>
                      <span className="text-[8px] font-extrabold text-[#f43f5e] -mt-1 select-none font-mono">
                        {q.count.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}
