"""Database model for the Student Clearance Management System.

Timestamps are stored as UTC ISO-8601 strings. That keeps ordering portable
between SQLite (development/tests) and PostgreSQL (production) and lets the API
return exactly what the React client expects.
"""

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .utils import now_iso


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    requires_payment: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fee: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    tasks: Mapped[list["ClearanceTask"]] = relationship(back_populates="department")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False, index=True)  # student | officer | admin
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[str] = mapped_column(String(32), default=now_iso, nullable=False)

    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"), nullable=True)

    # Student profile fields
    student_number: Mapped[str | None] = mapped_column(String(40), unique=True, nullable=True)
    programme: Mapped[str | None] = mapped_column(String(160), nullable=True)
    faculty: Mapped[str | None] = mapped_column(String(160), nullable=True)
    year_of_study: Mapped[str | None] = mapped_column(String(10), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)

    department: Mapped[Department | None] = relationship()


class ClearanceRequest(Base):
    __tablename__ = "clearance_requests"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    ref: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[str] = mapped_column(String(32), default=now_iso, nullable=False)
    updated_at: Mapped[str] = mapped_column(String(32), default=now_iso, nullable=False)

    # Snapshot of the application form at submission time.
    student_number: Mapped[str] = mapped_column(String(40), nullable=False)
    programme: Mapped[str] = mapped_column(String(160), nullable=False)
    faculty: Mapped[str] = mapped_column(String(160), nullable=False)
    year_of_study: Mapped[str] = mapped_column(String(10), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    certificate_number: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)
    certificate_code: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    certificate_issued_at: Mapped[str | None] = mapped_column(String(32), nullable=True)

    student: Mapped[User] = relationship()
    tasks: Mapped[list["ClearanceTask"]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="ClearanceTask.position"
    )
    documents: Mapped[list["Document"]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="Document.uploaded_at"
    )
    payment: Mapped["Payment | None"] = relationship(
        back_populates="request", cascade="all, delete-orphan", uselist=False
    )


class ClearanceTask(Base):
    __tablename__ = "clearance_tasks"
    __table_args__ = (UniqueConstraint("request_id", "department_id", name="uq_task_request_department"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    request_id: Mapped[str] = mapped_column(
        ForeignKey("clearance_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), default="Pending", nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    officer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[str | None] = mapped_column(String(32), nullable=True)

    request: Mapped[ClearanceRequest] = relationship(back_populates="tasks")
    department: Mapped[Department] = relationship(back_populates="tasks")
    officer: Mapped[User | None] = relationship()
    events: Mapped[list["TaskEvent"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="TaskEvent.at"
    )


class TaskEvent(Base):
    __tablename__ = "task_events"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    task_id: Mapped[str] = mapped_column(
        ForeignKey("clearance_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    at: Mapped[str] = mapped_column(String(32), default=now_iso, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # Submitted | Approved | Rejected | Resubmitted
    by_name: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)

    task: Mapped[ClearanceTask] = relationship(back_populates="events")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    request_id: Mapped[str] = mapped_column(
        ForeignKey("clearance_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    uploaded_at: Mapped[str] = mapped_column(String(32), default=now_iso, nullable=False)

    request: Mapped[ClearanceRequest] = relationship(back_populates="documents")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    request_id: Mapped[str] = mapped_column(
        ForeignKey("clearance_requests.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="Unpaid", nullable=False)
    method: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tx_ref: Mapped[str | None] = mapped_column(String(40), nullable=True)
    paid_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), default=now_iso, nullable=False)

    request: Mapped[ClearanceRequest] = relationship(back_populates="payment")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[str] = mapped_column(String(32), default=now_iso, nullable=False, index=True)

    user: Mapped[User] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    at: Mapped[str] = mapped_column(String(32), default=now_iso, nullable=False, index=True)
    actor_id: Mapped[str] = mapped_column(String(40), default="system", nullable=False)
    actor_name: Mapped[str] = mapped_column(String(160), default="System", nullable=False)
    action: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    details: Mapped[str] = mapped_column(Text, default="", nullable=False)


class Counter(Base):
    __tablename__ = "counters"

    name: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
