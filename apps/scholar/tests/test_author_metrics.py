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
