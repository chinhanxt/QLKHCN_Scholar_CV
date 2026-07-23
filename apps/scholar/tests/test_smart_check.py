import pytest
from unittest.mock import patch, MagicMock
from apps.scholar.models import AuthorProfile, Publication, AutoScanConfig
from apps.scholar.tasks import scrape_author_cv_smart_task, sync_scholar_profile_from_author


@pytest.mark.django_db
def test_scrape_author_cv_smart_task_fetches_and_adds_new_publications():
    author = AuthorProfile.objects.create(
        scholar_id="vIowI28AAAAJ",
        name="Chí Nhân",
        citedby=10,
        hindex=2,
        i10index=1
    )
    # Existing 6 publications
    for i in range(1, 7):
        Publication.objects.create(
            author=author,
            title=f"Paper {i}",
            display_order=i-1
        )

    # Mock online author profile returned by scholarly with 7 publications
    mock_online_author = {
        "scholar_id": "vIowI28AAAAJ",
        "name": "Chí Nhân",
        "citedby": 15,
        "hindex": 3,
        "i10index": 2,
        "publications": [
            {"bib": {"title": f"Paper {i}", "author": "Chí Nhân", "venue": "Journal X", "pub_year": "2024"}, "num_citations": 5}
            for i in range(1, 7)
        ] + [
            # 7th new paper!
            {"bib": {"title": "Paper 7 (New Article)", "author": "Chí Nhân", "venue": "Top Journal", "pub_year": "2026"}, "num_citations": 0}
        ]
    }

    with patch("apps.scholar.scholarly.scholarly.search_author_id", return_value={"scholar_id": "vIowI28AAAAJ"}) as mock_search, \
         patch("apps.scholar.scholarly.scholarly.fill", return_value=mock_online_author) as mock_fill, \
         patch("apps.scholar.scholarly.tor_helper.setup_tor_proxy_with_fallback"), \
         patch("time.sleep"):

        res = scrape_author_cv_smart_task(author.id)

    author.refresh_from_db()
    assert res["status"] == "success"
    assert res["new_publications_added"] == 1
    assert author.publications.count() == 7
    assert author.citedby == 15
    assert author.hindex == 3
    assert author.publication_count_cached == 7


@pytest.mark.django_db
def test_sync_approved_user_scholar_profile_on_background_scan():
    from django.contrib.auth import get_user_model
    from apps.scholar.models import ScholarProfile, ProfileStatus

    User = get_user_model()
    user = User.objects.create_user(username="chinhan", email="chinhan@example.com", password="password123")
    
    # Approved user profile in system
    user_profile = ScholarProfile.objects.create(
        user=user,
        scholar_id="vIowI28AAAAJ",
        status=ProfileStatus.APPROVED,
        total_citations=10,
        h_index=2,
        i10_index=1
    )

    author = AuthorProfile.objects.create(
        scholar_id="vIowI28AAAAJ",
        name="Chí Nhân",
        citedby=10,
        hindex=2,
        i10index=1
    )

    mock_online_author = {
        "scholar_id": "vIowI28AAAAJ",
        "name": "Chí Nhân",
        "citedby": 20,
        "hindex": 4,
        "i10index": 3,
        "publications": [
            {"bib": {"title": f"Paper {i}", "author": "Chí Nhân", "venue": "Journal X", "pub_year": "2024"}, "num_citations": 5}
            for i in range(1, 8)
        ]
    }

    with patch("apps.scholar.scholarly.scholarly.search_author_id", return_value={"scholar_id": "vIowI28AAAAJ"}), \
         patch("apps.scholar.scholarly.scholarly.fill", return_value=mock_online_author), \
         patch("apps.scholar.scholarly.tor_helper.setup_tor_proxy_with_fallback"), \
         patch("time.sleep"):

        res = scrape_author_cv_smart_task(author.id)

    user_profile.refresh_from_db()
    assert user_profile.total_citations == 20
    assert user_profile.h_index == 4
    assert user_profile.i10_index == 3
    assert user_profile.publications.count() == 7

