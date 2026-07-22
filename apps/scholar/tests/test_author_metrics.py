from django.test import TestCase
from rest_framework.test import APITestCase
from apps.scholar.models import AuthorProfile
from apps.scholar.api.serializers import AuthorProfileDetailSerializer

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

