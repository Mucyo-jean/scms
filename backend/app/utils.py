import uuid
from datetime import datetime, timezone

TASK_PENDING = "Pending"
TASK_APPROVED = "Approved"
TASK_REJECTED = "Rejected"

OVERALL_IN_PROGRESS = "In Progress"
OVERALL_ATTENTION = "Requires Attention"
OVERALL_CLEARED = "Cleared"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str = "") -> str:
    return prefix + uuid.uuid4().hex[:12]


def overall_status(task_statuses: list[str]) -> str:
    if task_statuses and all(s == TASK_APPROVED for s in task_statuses):
        return OVERALL_CLEARED
    if TASK_REJECTED in task_statuses:
        return OVERALL_ATTENTION
    return OVERALL_IN_PROGRESS
