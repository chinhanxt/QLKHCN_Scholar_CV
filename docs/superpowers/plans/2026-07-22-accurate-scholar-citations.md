# Accurate Scholar Citations & 5-Year Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store official Google Scholar 5-year metrics (`citedby5y`, `hindex5y`, `i10index5y`) and profile-level yearly citation timeline (`cites_per_year`) in the database, and display accurate statistics on the frontend UI without fake placeholder formulas.

**Architecture:** Extend `AuthorProfile` Django model with 5-year metrics and author-level `cites_per_year` JSONField, populate them during scraping in `scrape_author_cv_smart_task`, expose them via REST API serializers, and bind the React frontend components directly to these official metrics.

**Tech Stack:** Django (Python), Celery, REST Framework, React (TypeScript), Tailwind CSS.

---

### Task 1: Extend AuthorProfile Model & Add Migration

**Files:**
- Modify: `apps/scholar/models.py:10-50`
- Create: `apps/scholar/migrations/0014_add_author_5year_metrics.py`

- [ ] **Step 1: Write Django test for new AuthorProfile fields**

Create or update test file `apps/scholar/tests/test_author_metrics.py`:
```python
from django.test import TestCase
from apps.scholar.models import AuthorProfile

class AuthorProfileMetricsTest(TestCase):
    def test_author_profile_5year_fields(self):
        author = AuthorProfile.objects.create(
            scholar_id="test_sc_id_123",
            name="Dr. Test Scholar",
            citedby=100,
            citedby5y=80,
            hindex=10,
            hindex5y=8,
            i10index=12,
            i10index5y=9,
            cites_per_year={"2021": 20, "2022": 30, "2023": 30}
        )
        self.assertEqual(author.citedby5y, 80)
        self.assertEqual(author.hindex5y, 8)
        self.assertEqual(author.i10index5y, 9)
        self.assertEqual(author.cites_per_year.get("2022"), 30)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python manage.py test apps.scholar.tests.test_author_metrics`
Expected: FAIL with `TypeError` or `FieldError` (unexpected keyword arguments `citedby5y`, `hindex5y`, etc.)

- [ ] **Step 3: Modify AuthorProfile model in `apps/scholar/models.py`**

Add `citedby5y`, `hindex5y`, `i10index5y`, and `cites_per_year` to `AuthorProfile`:
```python
class AuthorProfile(models.Model):
    scholar_id = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    affiliation = models.TextField(blank=True, null=True)
    email_domain = models.CharField(max_length=255, blank=True, null=True)
    citedby = models.IntegerField(default=0)
    citedby5y = models.IntegerField(default=0, help_text="Trích dẫn 5 năm gần nhất")
    hindex = models.IntegerField(default=0)
    hindex5y = models.IntegerField(default=0, help_text="h-index 5 năm gần nhất")
    i10index = models.IntegerField(default=0)
    i10index5y = models.IntegerField(default=0, help_text="i10-index 5 năm gần nhất")
    cites_per_year = models.JSONField(default=dict, blank=True, help_text="Lịch sử trích dẫn theo từng năm của Tác giả")
    interests = models.JSONField(default=list, blank=True)
    auto_scan_enabled = models.BooleanField(default=True)
    last_scan_status = models.CharField(max_length=50, default='PENDING')
    last_scraped_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.scholar_id})"
```

- [ ] **Step 4: Generate Django migration**

Run: `python manage.py makemigrations scholar`
Expected: Created `apps/scholar/migrations/0014_add_author_5year_metrics.py` (or next sequential migration number).

- [ ] **Step 5: Run migration**

Run: `python manage.py migrate`
Expected: Migration applied successfully.

- [ ] **Step 6: Run test to verify it passes**

Run: `python manage.py test apps.scholar.tests.test_author_metrics`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/scholar/models.py apps/scholar/migrations/0014_*.py apps/scholar/tests/test_author_metrics.py
git commit -m "feat: add 5-year metrics and cites_per_year fields to AuthorProfile model"
```

---

### Task 2: Update Scraper Task & API Serializer

**Files:**
- Modify: `apps/scholar/tasks.py:440-460`
- Modify: `apps/scholar/api/serializers.py:15-50`

- [ ] **Step 1: Write test for scraper task update & serializer output**

Update `apps/scholar/tests/test_author_metrics.py`:
```python
from rest_framework.test import APITestCase
from apps.scholar.models import AuthorProfile
from apps.scholar.api.serializers import AuthorProfileDetailSerializer

class AuthorProfileSerializerTest(APITestCase):
    def test_serializer_contains_5year_fields(self):
        author = AuthorProfile.objects.create(
            scholar_id="sc_test_456",
            name="Dr. Jane Doe",
            citedby=1000,
            citedby5y=850,
            hindex=20,
            hindex5y=15,
            i10index=30,
            i10index5y=25,
            cites_per_year={"2023": 200, "2024": 300, "2025": 350}
        )
        serializer = AuthorProfileDetailSerializer(author)
        data = serializer.data
        self.assertEqual(data["citedby5y"], 850)
        self.assertEqual(data["hindex5y"], 15)
        self.assertEqual(data["i10index5y"], 25)
        self.assertEqual(data["cites_per_year"]["2025"], 350)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python manage.py test apps.scholar.tests.test_author_metrics`
Expected: FAIL (KeyError for `citedby5y` in serializer output)

- [ ] **Step 3: Update `AuthorProfileDetailSerializer` in `apps/scholar/api/serializers.py`**

Ensure `citedby5y`, `hindex5y`, `i10index5y`, and `cites_per_year` are included in `AuthorProfileDetailSerializer`:
```python
class AuthorProfileDetailSerializer(serializers.ModelSerializer):
    publications = PublicationDetailSerializer(many=True, read_only=True)

    class Meta:
        model = AuthorProfile
        fields = [
            "id",
            "scholar_id",
            "name",
            "affiliation",
            "email_domain",
            "citedby",
            "citedby5y",
            "hindex",
            "hindex5y",
            "i10index",
            "i10index5y",
            "cites_per_year",
            "interests",
            "publications",
            "created_at",
            "updated_at",
        ]
```

- [ ] **Step 4: Update `scrape_author_cv_smart_task` in `apps/scholar/tasks.py`**

In `apps/scholar/tasks.py`, inside `scrape_author_cv_smart_task`:
```python
            # Save or update author profile with 5-year metrics & author-level cites_per_year
            author_profile, created = AuthorProfile.objects.update_or_create(
                scholar_id=author.get("scholar_id"),
                defaults={
                    "name": author.get("name", "Tác giả ẩn danh"),
                    "affiliation": author.get("affiliation", "Không rõ cơ quan công tác"),
                    "email_domain": author.get("email_domain", "") or None,
                    "citedby": author.get("citedby", 0),
                    "citedby5y": author.get("citedby5y", 0),
                    "hindex": author.get("hindex", 0),
                    "hindex5y": author.get("hindex5y", 0),
                    "i10index": author.get("i10index", 0),
                    "i10index5y": author.get("i10index5y", 0),
                    "cites_per_year": author.get("cites_per_year", {}),
                    "interests": interests,
                }
            )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python manage.py test apps.scholar.tests.test_author_metrics`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/scholar/api/serializers.py apps/scholar/tasks.py apps/scholar/tests/test_author_metrics.py
git commit -m "feat: populate and expose author 5-year metrics and cites_per_year in API"
```

---

### Task 3: Update Frontend TypeScript Interfaces & UI Display

**Files:**
- Modify: `frontend/src/api/endpoints/scholar.ts:102-116`
- Modify: `frontend/src/pages/ScholarScraperPage.tsx:755-780,1505-1588`

- [ ] **Step 1: Update `AuthorProfileDetail` interface in `frontend/src/api/endpoints/scholar.ts`**

```typescript
export interface AuthorProfileDetail {
  id: string
  scholar_id: string
  name: string
  affiliation: string
  email_domain?: string | null
  citedby: number
  citedby5y?: number
  hindex: number
  hindex5y?: number
  i10index: number
  i10index5y?: number
  cites_per_year?: Record<string, number>
  interests: string[]
  publications: PublicationDetail[]
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Update Sidebar Citation Card & Histogram in `frontend/src/pages/ScholarScraperPage.tsx`**

In `ScholarScraperPage.tsx`:
1. Calculate `citationValues` using official `profile.cites_per_year` when present, falling back to publication sums:
```tsx
  // Official Author-level yearly citation timeline from Google Scholar
  const authorCitesPerYear = profile?.cites_per_year || {}
  const officialYears = Object.keys(authorCitesPerYear).filter((y) => /^\d{4}$/.test(y)).sort()

  const citationValues = officialYears.length > 0
    ? officialYears.map((year) => ({ year, count: authorCitesPerYear[year] || 0 }))
    : (profile?.publications
        ? Array.from(
            new Set(
              profile.publications
                .flatMap((p) => Object.keys(p.cites_per_year || {}))
                .filter((y) => /^\d{4}$/.test(y))
            )
          ).sort().map((year) => ({
            year,
            count: profile.publications.reduce((sum, p) => sum + (p.cites_per_year?.[year] || 0), 0)
          }))
        : [])

  const recentCitationValues = citationValues.slice(-8)
  const maxRecentCites = Math.max(...recentCitationValues.map((v) => v.count), 1)
```

2. Replace dummy math formulas in the sidebar table (lines ~1508-1524):
```tsx
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-2 font-semibold">Số trích dẫn</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.citedby}</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.citedby5y ?? 0}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-semibold">Chỉ số h-index</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.hindex}</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.hindex5y ?? 0}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-semibold">Chỉ số i10-index</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.i10index}</td>
                      <td className="py-2 text-right font-bold text-slate-800">{profile.i10index5y ?? 0}</td>
                    </tr>
                  </tbody>
```

3. Update Sheet 1 in Excel Export handler (`handleExport` around line 400):
```tsx
      const infoFields = [
        ['Họ và tên tác giả', profile.name],
        ['Cơ quan công tác', profile.affiliation || 'Không rõ cơ quan công tác'],
        [isSelectiveExport ? 'Tổng số trích dẫn bài xuất' : 'Tổng số trích dẫn (Tất cả)', isSelectiveExport ? totalCitesOfExport : profile.citedby],
        ['Tổng số trích dẫn (5 năm gần nhất)', profile.citedby5y ?? 0],
        ['Chỉ số H-index (Tất cả)', profile.hindex || 0],
        ['Chỉ số H-index (5 năm gần nhất)', profile.hindex5y || 0],
        ['Chỉ số i10-index (Tất cả)', profile.i10index || 0],
        ['Chỉ số i10-index (5 năm gần nhất)', profile.i10index5y || 0]
      ]
```

- [ ] **Step 3: Build frontend to verify TypeScript compilation**

Run: `npm --prefix frontend run build`
Expected: `✓ built in X.XXs` with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/endpoints/scholar.ts frontend/src/pages/ScholarScraperPage.tsx
git commit -m "fix: bind frontend UI metrics and histogram to official author 5-year Scholar data"
```

---

### Task 4: End-to-End Verification & Sanity Check

**Files:**
- All modified files

- [ ] **Step 1: Run all backend tests**

Run: `python manage.py test apps.scholar`
Expected: All tests PASS cleanly.

- [ ] **Step 2: Run frontend production build check**

Run: `npm --prefix frontend run build`
Expected: SUCCESS

- [ ] **Step 3: Final Commit & Handoff**

```bash
git status
```
Ensure working tree is clean.
