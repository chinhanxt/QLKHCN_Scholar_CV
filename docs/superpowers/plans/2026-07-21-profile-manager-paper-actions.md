# Profile Manager Paper Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Edit and Delete buttons/modal to the publication detail view in Profile Manager page (`/scholar/profiles`).

**Architecture:** Pass `onEdit` and `onDelete` handlers from `ProfileManagerPage.tsx` to `<PublicationDetailPanel />`. Implement `handleDeleteSinglePub` (moves pub to trash, updates profile citations) and `openEditPubModal`/`handleSaveEditPub` (opens an edit dialog to modify publication attributes).

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons, Sonner toast.

---

### Task 1: Add Edit Modal State and Handlers in ProfileManagerPage

**Files:**
- Modify: `frontend/src/pages/ProfileManagerPage.tsx`

- [ ] **Step 1: Add `editingPublication` and `isEditPubModalOpen` state**

In `frontend/src/pages/ProfileManagerPage.tsx`:
Add state declarations:
```tsx
const [isEditPubModalOpen, setIsEditPubModalOpen] = useState(false)
const [editingPublication, setEditingPublication] = useState<PublicationDetail | null>(null)
```

- [ ] **Step 2: Add `handleDeleteSinglePub`, `openEditPubModal`, and `handleSaveEditPub` functions**

In `frontend/src/pages/ProfileManagerPage.tsx`:
Add functions:
```tsx
const handleDeleteSinglePub = (pubId: string, e?: React.MouseEvent) => {
  if (e) e.stopPropagation()
  if (!selectedProfile) return
  if (window.confirm('Bạn có chắc muốn xóa bài báo này và chuyển vào thùng rác?')) {
    const pubToDelete = selectedProfile.publications?.find(p => String(p.id) === String(pubId))
    if (pubToDelete) {
      setDeletedPublications(prev => [pubToDelete, ...prev])
      const newPubs = selectedProfile.publications.filter(p => String(p.id) !== String(pubId))
      const newTotalCites = newPubs.reduce((sum, p) => sum + (p.citations || 0), 0)
      setSelectedProfile({
        ...selectedProfile,
        publications: newPubs,
        citedby: newTotalCites
      })
      setSelectedPubId(null)
      toast.success('Đã chuyển bài báo vào thùng rác!')
    }
  }
}

const openEditPubModal = (pub: PublicationDetail, e?: React.MouseEvent) => {
  if (e) e.stopPropagation()
  setEditingPublication(pub)
  setPubForm({
    title: pub.title || '',
    authors_list: pub.authors_list || '',
    venue: pub.venue || '',
    year: pub.year || new Date().getFullYear().toString(),
    citations: pub.citations || 0,
    sjr_q: pub.sjr_q || 'N/A',
    if_val: pub.if_val || 'N/A',
    wos: pub.wos || 'N/A'
  })
  setIsEditPubModalOpen(true)
}

const handleSaveEditPub = (e: React.FormEvent) => {
  e.preventDefault()
  if (!selectedProfile || !editingPublication) return

  const updatedPub: PublicationDetail = {
    ...editingPublication,
    title: pubForm.title,
    authors_list: pubForm.authors_list,
    venue: pubForm.venue,
    year: pubForm.year,
    citations: Number(pubForm.citations),
    sjr_q: pubForm.sjr_q,
    if_val: pubForm.if_val,
    wos: pubForm.wos
  }

  const updatedPublications = selectedProfile.publications.map(p =>
    String(p.id) === String(editingPublication.id) ? updatedPub : p
  )
  const newTotalCites = updatedPublications.reduce((sum, p) => sum + (p.citations || 0), 0)

  setSelectedProfile({
    ...selectedProfile,
    publications: updatedPublications,
    citedby: newTotalCites
  })

  setIsEditPubModalOpen(false)
  setEditingPublication(null)
  toast.success('Cập nhật thông tin bài báo thành công!')
}
```

- [ ] **Step 3: Connect `onEdit` and `onDelete` to `<PublicationDetailPanel />`**

Update the `<PublicationDetailPanel />` rendering in `ProfileManagerPage.tsx`:
```tsx
<PublicationDetailPanel
  publication={selectedPub}
  authorName={selectedProfile.name}
  onBack={() => {
    setSelectedPubId(null)
    setIsSidebarCollapsed(false)
  }}
  onEdit={(pub, e) => openEditPubModal(pub, e)}
  onDelete={(pubId, e) => handleDeleteSinglePub(pubId, e)}
/>
```

- [ ] **Step 4: Render Edit Publication Modal in JSX**

Add Modal dialog JSX before the closing root `div`:
```tsx
{/* DIALOG MODAL: EDIT PUBLICATION */}
{isEditPubModalOpen && editingPublication && (
  <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
    <div className="bg-white border border-[#E5E7EB] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-in">
      <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
        <h3 className="font-bold text-sm text-[#0F172A] uppercase tracking-wider">Chỉnh sửa bài báo khoa học</h3>
        <button 
          onClick={() => {
            setIsEditPubModalOpen(false)
            setEditingPublication(null)
          }}
          className="p-1 rounded-lg hover:bg-slate-100 text-[#64748B] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSaveEditPub} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto custom-scrollbar">
        <div className="space-y-1">
          <label className="font-bold text-[#64748B] block">Tên bài báo khoa học *</label>
          <textarea 
            value={pubForm.title}
            onChange={(e) => setPubForm({ ...pubForm, title: e.target.value })}
            required
            rows={2}
            className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>
        <div className="space-y-1">
          <label className="font-bold text-[#64748B] block">Danh sách tác giả * (Cách nhau bằng dấu phẩy)</label>
          <input 
            type="text" 
            value={pubForm.authors_list}
            onChange={(e) => setPubForm({ ...pubForm, authors_list: e.target.value })}
            required
            className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>
        <div className="space-y-1">
          <label className="font-bold text-[#64748B] block">Nơi xuất bản (Journal / Conference / Venue)</label>
          <input 
            type="text" 
            value={pubForm.venue}
            onChange={(e) => setPubForm({ ...pubForm, venue: e.target.value })}
            className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-bold text-[#64748B] block">Năm xuất bản</label>
            <input 
              type="text" 
              value={pubForm.year}
              onChange={(e) => setPubForm({ ...pubForm, year: e.target.value })}
              className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
          <div className="space-y-1">
            <label className="font-bold text-[#64748B] block">Số trích dẫn *</label>
            <input 
              type="number" 
              value={pubForm.citations}
              onChange={(e) => setPubForm({ ...pubForm, citations: Number(e.target.value) })}
              required
              className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-bold text-[#64748B] block">Phân hạng SJR Quartile</label>
            <select 
              value={pubForm.sjr_q}
              onChange={(e) => setPubForm({ ...pubForm, sjr_q: e.target.value })}
              className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="N/A">N/A</option>
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="font-bold text-[#64748B] block">Danh mục Web of Science</label>
            <input 
              type="text" 
              value={pubForm.wos}
              onChange={(e) => setPubForm({ ...pubForm, wos: e.target.value })}
              className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={() => {
              setIsEditPubModalOpen(false)
              setEditingPublication(null)
            }}
            className="px-4 py-2 rounded-xl border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold transition-all cursor-pointer"
          >
            Cập nhật
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify build/type checking**

Run: `npm run build` or `npx tsc --noEmit` in `frontend` directory.
Expected: Build succeeds with 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add frontend/src/pages/ProfileManagerPage.tsx docs/
git commit -m "feat(scholar): add edit and delete actions to publication detail view in ProfileManager"
```
