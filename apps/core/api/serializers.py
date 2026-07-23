from rest_framework import serializers
from apps.core.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    created_at_human = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "message",
            "notification_type",
            "category",
            "metadata",
            "link",
            "is_read",
            "created_at",
            "created_at_human",
        ]
        read_only_fields = ["id", "created_at"]

    def get_created_at_human(self, obj):
        if not obj.created_at:
            return ""
        from django.utils.timesince import timesince
        return f"{timesince(obj.created_at)} trước"
