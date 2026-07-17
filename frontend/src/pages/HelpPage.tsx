import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, MessageSquare, PhoneCall } from 'lucide-react'

export function HelpPage() {
  return (
    <div className="flex flex-col gap-4 max-w-4xl">

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5 space-y-3">
            <div className="p-2 rounded-lg bg-[#e6f0f7] text-[#005b9a] w-fit">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">Tài liệu Hướng dẫn</h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Xem tài liệu hướng dẫn vận hành 6 công cụ chính, cách cấu hình proxy và giải quyết lỗi captcha.
            </p>
            <a href="#" className="text-xs font-bold text-[#005b9a] hover:underline block pt-1">Xem tài liệu →</a>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5 space-y-3">
            <div className="p-2 rounded-lg bg-[#e6f0f7] text-[#005b9a] w-fit">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">Cộng đồng & Phản hồi</h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Báo cáo lỗi phát sinh trong quá trình cào dữ liệu hoặc đóng góp ý kiến cải tiến giao diện.
            </p>
            <a href="#" className="text-xs font-bold text-[#005b9a] hover:underline block pt-1">Gửi phản hồi →</a>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5 space-y-3">
            <div className="p-2 rounded-lg bg-[#e6f0f7] text-[#005b9a] w-fit">
              <PhoneCall className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">Liên hệ kỹ thuật</h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Liên hệ trực tiếp với bộ phận phát triển để nhận trợ giúp cấu hình crawler nâng cao.
            </p>
            <a href="#" className="text-xs font-bold text-[#005b9a] hover:underline block pt-1">Liên hệ ngay →</a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
