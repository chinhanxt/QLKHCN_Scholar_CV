from django.utils import timezone
from unfold.admin import ModelAdmin


class BaseModelAdmin(ModelAdmin):
    """Base admin class for all models."""

    readonly_fields = ("id", "created_at", "updated_at")
    list_per_page = 25
    save_on_top = True


class SoftDeleteModelAdmin(BaseModelAdmin):
    """Admin class for soft-delete models."""

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "is_deleted",
        "deleted_at",
        "deleted_by",
    )

    def get_queryset(self, request):
        return self.model.all_objects.all()

    def delete_model(self, request, obj):
        obj.soft_delete(user=request.user)

    def delete_queryset(self, request, queryset):
        queryset.update(
            is_deleted=True,
            deleted_at=timezone.now(),
            deleted_by=request.user,
        )
