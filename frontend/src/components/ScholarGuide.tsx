import { useState } from 'react'
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Edit3,
  Globe,
  Maximize2,
  CheckCircle2,
  X,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface GuideStep {
  step: number
  title: string
  desc: string
  highlight: string
  imgSrc: string
  imgAlt: string
  icon: typeof LinkIcon
}

const GUIDE_STEPS: GuideStep[] = [
  {
    step: 1,
    title: 'Lấy đường dẫn (URL) hồ sơ',
    desc: 'Truy cập Google Scholar cá nhân và sao chép URL trên thanh địa chỉ.',
    highlight: 'Ví dụ link dạng: ...user=hbssfjifja',
    imgSrc: '/guide/step1_get_link.png',
    imgAlt: 'Hướng dẫn sao chép URL Google Scholar',
    icon: LinkIcon,
  },
  {
    step: 2,
    title: 'Mở chỉnh sửa hồ sơ',
    desc: 'Tại trang Google Scholar cá nhân, bấm biểu tượng cây bút bên cạnh tên.',
    highlight: 'Bấm biểu tượng cây bút bên cạnh tên',
    imgSrc: '/guide/step2_edit_profile.png',
    imgAlt: 'Biểu tượng cây bút chỉnh sửa Google Scholar',
    icon: Edit3,
  },
  {
    step: 3,
    title: 'Bật chế độ công khai (Public)',
    desc: 'Tích chọn "Đặt tiểu sử của tôi ở chế độ công khai" rồi bấm Lưu.',
    highlight: 'Bắt buộc tích chọn chế độ công khai',
    imgSrc: '/guide/step3_public_setting.png',
    imgAlt: 'Tích chọn Đặt tiểu sử của tôi ở chế độ công khai',
    icon: Globe,
  },
]

interface ScholarGuideProps {
  defaultOpen?: boolean
  className?: string
}

export function ScholarGuide({ defaultOpen = false, className }: ScholarGuideProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [activeImage, setActiveImage] = useState<{ src: string; title: string } | null>(null)

  return (
    <div className={cn('rounded-xl border border-blue-100 bg-slate-50/70 overflow-hidden text-slate-800 transition-all', className)}>
      {/* Header / Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50/60 hover:bg-blue-100/50 text-left transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#005b9a] text-white shadow-2xs shrink-0">
            <HelpCircle className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              Hướng dẫn lấy link Google Scholar & Bật chế độ công khai
            </h4>
            <p className="text-[11px] text-slate-500">
              Nhấn vào đây để xem 3 bước chi tiết có hình ảnh minh họa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs font-semibold text-[#005b9a]">
          <span>{isOpen ? 'Thu gọn' : 'Xem hướng dẫn'}</span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Guide Content */}
      {isOpen && (
        <div className="p-4 space-y-4 border-t border-blue-100/70 animate-in fade-in duration-200">
          {/* Important note banner */}
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Lưu ý quan trọng: </span>
              Nếu hồ sơ ở chế độ <strong>Riêng tư (Private)</strong>, hệ thống sẽ báo lỗi không tìm thấy dữ liệu hoặc không quét được bài báo. Vui lòng đảm bảo thực hiện <strong>Bước 3</strong> bên dưới.
            </div>
          </div>

          {/* 3 Step Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {GUIDE_STEPS.map((item) => {
              const IconComponent = item.icon
              return (
                <div
                  key={item.step}
                  className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all"
                >
                  <div className="space-y-2.5">
                    {/* Step Title Header */}
                    <div className="flex items-center gap-2 h-6">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#005b9a] text-[10px] font-bold text-white shrink-0">
                        {item.step}
                      </span>
                      <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <IconComponent className="h-3.5 w-3.5 text-[#005b9a] shrink-0" />
                        {item.title}
                      </h5>
                    </div>

                    {/* Shortened Description with Fixed Height for Alignment */}
                    <p className="text-[11px] text-slate-600 leading-normal h-9 flex items-center">
                      {item.desc}
                    </p>

                    {/* Green Highlight Badge - Single line, tight & clean */}
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200/80 w-full">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="leading-tight truncate" title={item.highlight}>{item.highlight}</span>
                    </div>
                  </div>

                  {/* Thumbnail Image Container (Uncropped & Clear) */}
                  <div
                    onClick={() => setActiveImage({ src: item.imgSrc, title: `Bước ${item.step}: ${item.title}` })}
                    className="relative mt-3 cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-slate-100/90 p-2 flex items-center justify-center min-h-[120px] group-hover:border-blue-400 group-hover:bg-slate-100 transition-all"
                  >
                    <img
                      src={item.imgSrc}
                      alt={item.imgAlt}
                      className="w-full max-h-36 object-contain rounded-md transition-transform duration-200 group-hover:scale-102"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center rounded-xl">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg border border-slate-700">
                        <Maximize2 className="h-3.5 w-3.5" /> Bấm để phóng to
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {activeImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setActiveImage(null)}
        >
          <div
            className="relative max-w-3xl w-full rounded-2xl bg-white p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900">{activeImage.title}</h3>
              <button
                type="button"
                onClick={() => setActiveImage(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900 flex items-center justify-center max-h-[75vh]">
              <img
                src={activeImage.src}
                alt={activeImage.title}
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>

            <p className="text-center text-xs text-slate-500 italic">
              Nhấn bất kỳ đâu bên ngoài hoặc phím ESC để đóng
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
