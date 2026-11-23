"""Read endpoints for departments, users, audit trail and the client snapshot."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import AuditLog, ClearanceRequest, ClearanceTask, Department, Notification, User
from ..serialize import audit_public, department_public, notification_public, request_public, user_public

router = APIRouter(tags=["catalog"])


@router.get("/bootstrap")
def bootstrap(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Role-scoped snapshot used by the React client's read cache.

    The granular endpoints below remain the source of truth; this endpoint just
    saves the UI from issuing a dozen requests on every page load. Every
    mutation still goes through the guarded REST endpoints.
    """
    departments = db.scalars(select(Department).order_by(Department.name)).all()
    notifications = db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc())
    ).all()

    if user.role == "admin":
        users = db.scalars(select(User).order_by(User.name)).all()
        requests = db.scalars(select(ClearanceRequest).order_by(ClearanceRequest.created_at.desc())).all()
        audit = db.scalars(select(AuditLog).order_by(AuditLog.at.desc()).limit(500)).all()
    elif user.role == "officer":
        requests = db.scalars(
            select(ClearanceRequest)
            .join(ClearanceTask)
            .where(ClearanceTask.department_id == user.department_id)
            .order_by(ClearanceRequest.created_at.desc())
        ).unique().all()
        student_ids = {request.student_id for request in requests}
        officers = db.scalars(select(User).where(User.role.in_(["officer", "admin"]))).all()
        students = (
            db.scalars(select(User).where(User.id.in_(student_ids))).all() if student_ids else []
        )
        users = list({person.id: person for person in [*officers, *students, user]}.values())
        audit = []
    else:
        requests = db.scalars(
            select(ClearanceRequest)
            .where(ClearanceRequest.student_id == user.id)
            .order_by(ClearanceRequest.created_at.desc())
        ).all()
        officers = db.scalars(select(User).where(User.role == "officer")).all()
        users = [user, *officers]
        audit = []

    return {
        "me": user_public(user),
        "departments": [department_public(department) for department in departments],
        "users": [user_public(person) for person in users],
        "requests": [request_public(request) for request in requests],
        "notifications": [notification_public(item) for item in notifications],
        "audit": [audit_public(entry) for entry in audit],
    }


@router.get("/departments")
def list_departments(
    _: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    departments = db.scalars(select(Department).order_by(Department.name)).all()
    return [department_public(department) for department in departments]


@router.get("/users")
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.name)).all()
    return [user_public(person) for person in users]


@router.get("/audit")
def list_audit(
    action: str | None = None,
    q: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    statement = select(AuditLog).order_by(AuditLog.at.desc())
    if action:
        statement = statement.where(AuditLog.action == action)
    entries = db.scalars(statement.limit(500)).all()
    needle = (q or "").strip().lower()
    if needle:
        entries = [
            entry
            for entry in entries
            if needle in entry.actor_name.lower() or needle in entry.details.lower()
        ]
    return [audit_public(entry) for entry in entries[:limit]]
