"""Test that admin sidebar navigation links resolve to valid URL paths."""

from django.conf import settings


def test_sidebar_links_are_resolved_urls():
    """Sidebar links must be resolved URL paths (starting with '/'),
    not bare URL names like 'admin:users_user_changelist' which the browser
    interprets as a protocol scheme and triggers xdg-open.
    """
    navigation = settings.UNFOLD["SIDEBAR"]["navigation"]

    for group in navigation:
        for item in group.get("items", []):
            link = item["link"]
            # If it's a callable, skip — Unfold handles those correctly
            if callable(link):
                continue
            # A resolved URL must start with '/' — bare URL names like
            # 'admin:foo_bar_changelist' do NOT and cause the xdg-open bug
            assert str(link).startswith("/"), (
                f"Sidebar link for '{item['title']}' is '{link}' — "
                f"must be a resolved URL path (starting with '/'), "
                f"not a bare URL name. Use reverse_lazy() to fix."
            )
