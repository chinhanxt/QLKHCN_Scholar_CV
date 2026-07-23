import { useState, useEffect } from 'react'
import { notificationApi } from '@/api/endpoints/notifications'
import type { EmailTemplateItem, EmailSettings } from '@/api/endpoints/notifications'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { FileText, Eye, Edit3, Send, RotateCcw, Check, X, Code, Sparkles } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

interface EmailTemplateManagerProps {
  smtpForm?: Partial<EmailSettings>
}

export function EmailTemplateManager({ smtpForm }: EmailTemplateManagerProps) {
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeModal, setActiveModal] = useState<'preview' | 'edit' | 'send' | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateItem | null>(null)

  // Edit State
  const [editSubject, setEditSubject] = useState('')
  const [editHtml, setEditHtml] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Preview State
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewTab, setPreviewTab] = useState<'visual' | 'code'>('visual')

  // Send Test State
  const [testEmail, setTestEmail] = useState('')
  const [isSendingTest, setIsSendingTest] = useState(false)

  const fetchTemplates = async () => {
    setIsLoading(true)
    try {
      const res = await notificationApi.getEmailTemplates()
      setTemplates(res.data)
    } catch {
      toast.error('Không thể tải danh sách mẫu email.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const handleOpenPreview = async (tpl: EmailTemplateItem) => {
    setSelectedTemplate(tpl)
    setActiveModal('preview')
    setPreviewTab('visual')
    setIsPreviewLoading(true)
    try {
      const res = await notificationApi.previewEmailTemplate(tpl.template_key)
      setPreviewHtml(res.data.html)
      setPreviewSubject(res.data.subject)
    } catch {
      toast.error('Không thể tải bản xem trước mẫu email.')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const handleOpenEdit = (tpl: EmailTemplateItem) => {
    setSelectedTemplate(tpl)
    setEditSubject(tpl.subject)
    setEditHtml(tpl.html_content)
    setActiveModal('edit')
  }

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return
    setIsSaving(true)
    try {
      const res = await notificationApi.updateEmailTemplate(selectedTemplate.template_key, {
        subject: editSubject,
        html_content: editHtml,
      })
      toast.success(res.data.message || 'Đã lưu mẫu email thành công!')
      setActiveModal(null)
      fetchTemplates()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Lưu mẫu email thất bại.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetTemplate = async () => {
    if (!selectedTemplate) return
    if (!confirm(`Bạn có chắc muốn khôi phục mẫu email "${selectedTemplate.name}" về mặc định ban đầu?`)) return
    setIsResetting(true)
    try {
      const res = await notificationApi.resetEmailTemplate(selectedTemplate.template_key)
      toast.success(res.data.message || 'Đã khôi phục mẫu email mặc định!')
      setActiveModal(null)
      fetchTemplates()
    } catch {
      toast.error('Khôi phục mẫu email thất bại.')
    } finally {
      setIsResetting(false)
    }
  }

  const handleOpenSend = (tpl: EmailTemplateItem) => {
    setSelectedTemplate(tpl)
    setActiveModal('send')
  }

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate || !testEmail) {
      toast.error('Vui lòng nhập địa chỉ email nhận thư thử nghiệm!')
      return
    }
    setIsSendingTest(true)
    try {
      const res = await notificationApi.sendTemplateTestEmail(selectedTemplate.template_key, testEmail, smtpForm)
      toast.success(res.data.message || `Đã gửi mẫu thư thử nghiệm tới ${testEmail}!`)
      setActiveModal(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gửi mail thử nghiệm thất bại.')
    } finally {
      setIsSendingTest(false)
    }
  }

  const insertVariable = (varName: string) => {
    const varTag = `{{ ${varName} }}`
    setEditHtml((prev) => prev + varTag)
    toast.info(`Đã chèn thẻ ${varTag}`)
  }

  if (isLoading) {
    return (
      <Card className="border-slate-200 bg-white p-6 flex justify-center shadow-sm">
        <Spinner className="h-6 w-6 text-[#005b9a]" />
      </Card>
    )
  }

  return (
    <div className="space-y-4 pt-2">
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-[#005b9a]" />
                Quản lý & Tùy chỉnh Các Mẫu Email Thông Báo (Email Templates)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Xem trước giao diện thực tế, tùy biến tiêu đề & nội dung HTML của tất cả 3 form mẫu thông báo hệ thống.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <Sparkles className="w-3.5 h-3.5" /> 3 Forms Hoạt Động
            </span>
          </div>

          {/* List of Email Templates */}
          <div className="grid gap-4 md:grid-cols-3">
            {templates.map((tpl) => (
              <div
                key={tpl.template_key}
                className="flex flex-col justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#005b9a]/40 hover:shadow-md transition-all group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-800 group-hover:text-[#005b9a] transition-colors line-clamp-1">
                      {tpl.name}
                    </h3>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 shrink-0">
                      {tpl.template_key}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </p>

                  <div className="bg-white p-2 rounded-lg border border-slate-100 text-[11px] font-mono text-slate-600 truncate">
                    <span className="text-slate-400 font-sans">Tiêu đề: </span>
                    {tpl.subject}
                  </div>

                  {/* Variables Badges */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tpl.available_variables?.map((v) => (
                      <span key={v} className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 flex items-center justify-between border-t border-slate-200/60 mt-3 gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(tpl)}
                    className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Xem trước mẫu"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    Xem
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(tpl)}
                    className="flex-1 bg-[#005b9a]/10 hover:bg-[#005b9a] hover:text-white text-[#005b9a] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title="Chỉnh sửa nội dung HTML"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Sửa
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenSend(tpl)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer shrink-0"
                    title="Gửi thư thử mẫu này"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Test
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* --- PREVIEW MODAL --- */}
      {activeModal === 'preview' && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#005b9a]" />
                  Xem trước: {selectedTemplate.name}
                </h3>
                <p className="text-xs text-slate-500">Xem trước giao diện thư thực tế sẽ nhận trong Gmail.</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-slate-200 p-0.5 rounded-lg flex text-xs">
                  <button
                    onClick={() => setPreviewTab('visual')}
                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                      previewTab === 'visual' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Trực quan
                  </button>
                  <button
                    onClick={() => setPreviewTab('code')}
                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                      previewTab === 'code' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Mã HTML
                  </button>
                </div>

                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Subject preview */}
            <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 text-xs font-mono text-slate-700 flex items-center gap-2">
              <span className="font-bold font-sans text-slate-500">Tiêu đề thư (Subject):</span>
              <span className="font-bold text-slate-900">{previewSubject || selectedTemplate.subject}</span>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex-1 overflow-y-auto bg-slate-100/40">
              {isPreviewLoading ? (
                <div className="flex justify-center items-center py-20">
                  <Spinner className="w-8 h-8 text-[#005b9a]" />
                </div>
              ) : previewTab === 'visual' ? (
                <iframe
                  title="Email Preview"
                  srcDoc={previewHtml}
                  className="w-full min-h-[420px] rounded-xl border border-slate-200 shadow-inner bg-white"
                />
              ) : (
                <pre className="p-4 bg-slate-950 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
                  {selectedTemplate.html_content}
                </pre>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
              <button
                onClick={() => handleOpenSend(selectedTemplate)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Gửi Thử Mẫu Này
              </button>

              <button
                onClick={() => setActiveModal(null)}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-300 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL --- */}
      {activeModal === 'edit' && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#005b9a]" />
                  Tùy chỉnh Nội dung Form Email: {selectedTemplate.name}
                </h3>
                <p className="text-xs text-slate-500">Chỉnh sửa Tiêu đề & Cú pháp HTML template của thông báo.</p>
              </div>

              <button
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Inputs */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">Tiêu đề thư (Subject Line)</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono focus:bg-white focus:ring-2 focus:ring-[#005b9a]/20"
                />
              </div>

              {/* Variables Bar */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase flex items-center justify-between">
                  <span>Các Biến Dữ Liệu Có Thể Chèn (Bấm để chèn vào HTML):</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {selectedTemplate.available_variables?.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Code className="w-3 h-3 text-slate-400" />
                      {`{{ ${v} }}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* HTML Content Editor */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">Nội dung Template (HTML Code)</label>
                <textarea
                  rows={16}
                  value={editHtml}
                  onChange={(e) => setEditHtml(e.target.value)}
                  className="w-full mt-1 p-3 text-xs rounded-xl border border-slate-200 bg-slate-950 text-slate-100 font-mono leading-relaxed focus:ring-2 focus:ring-[#005b9a]/30 resize-y"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
              <button
                type="button"
                onClick={handleResetTemplate}
                disabled={isResetting}
                className="bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isResetting ? <Spinner className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Khôi Phục Mẫu Gốc
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-300 transition-colors"
                >
                  Hủy
                </button>

                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={isSaving}
                  className="bg-[#005b9a] text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-[#004b80] transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {isSaving ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  Lưu Tùy Chỉnh Form
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SEND TEST MODAL --- */}
      {activeModal === 'send' && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" />
                Gửi Thử Mẫu: {selectedTemplate.name}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} className="p-5 space-y-4">
              <p className="text-xs text-slate-500">
                Nhập email cá nhân để nhận trực tiếp một bản thư thử nghiệm của form <strong>{selectedTemplate.name}</strong>.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">Hòm Thư Nhận (Email)</label>
                <input
                  type="email"
                  placeholder="nhan.email@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-300 transition-colors"
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {isSendingTest ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  Gửi Mail Thử
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
