import structlog
from celery import Task

logger = structlog.get_logger(__name__)


class BaseTask(Task):
    """Base task with logging and error handling."""

    autoretry_for = (Exception,)
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True
    max_retries = 3

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error("task_failed", task=self.name, task_id=task_id, error=str(exc))
        super().on_failure(exc, task_id, args, kwargs, einfo)

    def on_success(self, retval, task_id, args, kwargs):
        logger.info("task_succeeded", task=self.name, task_id=task_id)
        super().on_success(retval, task_id, args, kwargs)
