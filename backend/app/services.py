"""Domain services: workflow rules, notifications, audit trail and certificates."""

import re
import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import (
    AuditLog,
    ClearanceRequest,
    ClearanceTask,
    Counter,
    Department,
    Notification,
    TaskEvent,
    User,
)
from .utils import (
    OVERALL_CLEARED,
    TASK_APPROVED,
    TASK_PENDING,
    TASK_REJECTED,
    new_id,
    now_iso,
    overall_status,
)

EMAIL_RE = re.compile(r"^\S+@\S+\.\S+$")


# ---------- validation helpers ----------


def validate_password(password: str) -> str | None:
    if len(password) < 8:
        return "Password must use at least 8 characters."
    if not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password) or not re.search(r"\d", password):
        return "Password must include upper-case, lower-case letters and a number."
    return None


# ---------- lookups ----------


def department_name(db: Session, department_id: str) -> str:
    department = db.get(Department, department_id)
    return department.name if department else "Unknown department"


def open_request(db: Session, student_id: str) -> ClearanceRequest | None:
    requests = db.scalars(
        select(ClearanceRequest).where(ClearanceRequest.student_id == student_id)
    ).all()
    for request in requests:
        if overall_status([task.status for task in request.tasks]) != OVERALL_CLEARED:
            return request
    return None


def next_counter(db: Session, name: str) -> int:
    # Row lock serialises reference allocation on PostgreSQL; SQLite ignores it.
    counter = db.scalar(select(Counter).where(Counter.name == name).with_for_update())
    if counter is None:
        counter = Counter(name=name, value=1)
        db.add(counter)
    else:
        counter.value += 1
    db.flush()
    return counter.value


# ---------- audit & notifications ----------


def audit(db: Session, actor: User | None, action: str, entity_id: str | None, details: str) -> None:
    db.add(
        AuditLog(
            id=new_id("a_"),
            at=now_iso(),
            actor_id=actor.id if actor else "system",
            actor_name=actor.name if actor else "System",
            action=action,
            entity_id=entity_id,
            details=details,
        )
    )


def notify(db: Session, user_id: str, title: str, message: str, link: str | None = None) -> None:
    db.add(
        Notification(
            id=new_id("n_"),
            user_id=user_id,
            title=title,
            message=message,
            link=link,
            read=False,
            created_at=now_iso(),
        )
    )


def notify_department_officers(
    db: Session, department_id: str, title: str, message: str, link: str | None = None
) -> None:
    officers = db.scalars(
        select(User).where(
            User.role == "officer",
            User.department_id == department_id,
            User.active.is_(True),
        )
    ).all()
    for officer in officers:
        notify(db, officer.id, title, message, link)


# ---------- task events ----------


def add_event(db: Session, task: ClearanceTask, status: str, by_name: str, note: str = "") -> None:
    db.add(
        TaskEvent(
            id=new_id("ev_"),
            task_id=task.id,
            at=now_iso(),
            status=status,
            by_name=by_name,
            note=note,
        )
    )


# ---------- certificates ----------


def _new_certificate_code(db: Session) -> str:
    while True:
        code = f"{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}"
        exists = db.scalar(select(func.count()).select_from(ClearanceRequest).where(
            ClearanceRequest.certificate_code == code
        ))
        if not exists:
            return code


def complete_if_cleared(db: Session, request: ClearanceRequest) -> None:
    """Issue the certificate once every task is approved (idempotent)."""
    if request.certificate_number:
        return
    if overall_status([task.status for task in request.tasks]) != OVERALL_CLEARED:
        return

    suffix = request.ref.rsplit("-", 1)[-1]
    year = request.created_at[:4]
    request.certificate_number = f"MCL-CERT-{year}-{suffix}"
    request.certificate_code = _new_certificate_code(db)
    request.certificate_issued_at = now_iso()
    request.updated_at = now_iso()
    audit(
        db,
        None,
        "CLEARANCE_COMPLETED",
        request.id,
        f"{request.ref} cleared; certificate {request.certificate_number} issued",
    )
    notify(
        db,
        request.student_id,
        "Clearance completed 🎉",
        "All departments have approved your clearance. Your digital clearance certificate is ready.",
        f"/student/requests/{request.id}/certificate",
    )
    db.flush()


# ---------- document limits ----------


MAX_FILES = 5
MAX_FILE_SIZE = 2 * 1024 * 1024
ALLOWED_FILE_TYPES = {"application/pdf", "image/jpeg", "image/png"}


def validate_upload(content_type: str | None, size: int, filename: str) -> str | None:
    if content_type not in ALLOWED_FILE_TYPES:
        return f"{filename}: only PDF, JPG, PNG files are allowed."
    if size > MAX_FILE_SIZE:
        return f"{filename}: file is larger than 2 MB."
    if size == 0:
        return f"{filename}: the file is empty."
    return None


def ensure_decision_allowed(db: Session, task: ClearanceTask, decision: str, comment: str) -> None:
    if task.status != TASK_PENDING:
        raise ValueError("This item has already been decided.")
    department = db.get(Department, task.department_id)
    if decision == TASK_APPROVED and department and department.requires_payment:
        if task.request.payment is None or task.request.payment.status != "Paid":
            raise ValueError("The clearance fee must be paid before Finance can approve.")
    if decision == TASK_REJECTED and not comment.strip():
        raise ValueError("A rejection reason is required.")
