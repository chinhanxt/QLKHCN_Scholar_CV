import { useEffect, useRef } from 'react'
import { Terminal, Trash2, Copy, Play } from 'lucide-react'
import { toast } from 'sonner'

interface TerminalWindowProps {
  title?: string
  logs: string[]
  onClear?: () => void
  isRunning?: boolean
}

export function TerminalWindow({ title = 'System Console', logs, onClear, isRunning = false }: TerminalWindowProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const copyToClipboard = () => {
    if (logs.length === 0) return
    navigator.clipboard.writeText(logs.join('\n'))
    toast.success('Đã sao chép toàn bộ logs vào clipboard!')
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden font-mono text-sm text-slate-700">
      {/* Header bar */}
      <div className="flex h-10 items-center justify-between bg-slate-50 px-4 border-b border-slate-200" title={title}>
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-sky-600" />
          {isRunning && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-3">
          <button 
            onClick={copyToClipboard}
            disabled={logs.length === 0}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="Sao chép log"
          >
            <Copy className="h-3 w-3" />
            <span>COPY</span>
          </button>
          
          {onClear && (
            <button 
              onClick={onClear}
              disabled={logs.length === 0}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Xoá màn hình"
            >
              <Trash2 className="h-3 w-3" />
              <span>CLEAR</span>
            </button>
          )}

          <div className="flex gap-1.5 ml-2 border-l border-slate-200 pl-3">
            <span className="h-2 w-2 rounded-full bg-slate-300"></span>
            <span className="h-2 w-2 rounded-full bg-slate-300"></span>
            <span className="h-2 w-2 rounded-full bg-slate-300"></span>
          </div>
        </div>
      </div>

      {/* Terminal Screen (Light theme, White background, Blue/Dark-blue text) */}
      <div className="flex-1 min-h-[120px] max-h-[180px] overflow-y-auto p-4 custom-scrollbar bg-slate-50/30">
        {logs.length === 0 ? (
          <div className="flex h-[100px] flex-col items-center justify-center text-slate-400 gap-1.5">
            <Play className="h-6 w-6 opacity-45 animate-pulse text-sky-600" />
            <div className="text-[10px] uppercase font-bold tracking-widest">Hệ thống đang rảnh</div>
            <div className="text-[10px] opacity-75">Nhấp nút hành động ở trên để kích hoạt công cụ.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-1 leading-relaxed text-[13px]">
            {logs.map((log, idx) => {
              // Custom highlights for light terminal
              let colorClass = 'text-slate-600'
              if (log.startsWith('>>>') || log.startsWith('===')) {
                colorClass = 'text-sky-700 font-bold border-b border-slate-100 pb-0.5 mt-2'
              } else if (log.toLowerCase().includes('lỗi') || log.toLowerCase().includes('failed') || log.toLowerCase().includes('error')) {
                colorClass = 'text-red-600 font-semibold'
              } else if (log.toLowerCase().includes('hoàn thành') || log.toLowerCase().includes('success') || log.toLowerCase().includes('imported')) {
                colorClass = 'text-emerald-600 font-semibold'
              } else if (log.startsWith('  ')) {
                colorClass = 'text-slate-400 pl-4'
              }

              return (
                <div key={idx} className={`terminal-line ${colorClass}`}>
                  {log}
                </div>
              )
            })}
            
            {/* Blinking cursor if running */}
            {isRunning && (
              <div className="flex items-center gap-1 mt-1">
                <span className="h-3 w-1.5 bg-sky-600 animate-[pulse_1s_infinite]"></span>
                <span className="text-[11px] text-sky-600 font-bold italic">Đang xử lý...</span>
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
