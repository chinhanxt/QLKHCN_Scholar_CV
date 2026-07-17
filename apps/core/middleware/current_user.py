import threading

from django.utils.deprecation import MiddlewareMixin

_thread_locals = threading.local()


def get_current_user():
    """Get the current user from thread-local storage."""
    return getattr(_thread_locals, "user", None)


class CurrentUserMiddleware(MiddlewareMixin):
    """Middleware that stores the current user in thread-local storage."""

    def process_request(self, request):
        _thread_locals.user = getattr(request, "user", None)

    def process_response(self, request, response):
        _thread_locals.user = None
        return response
