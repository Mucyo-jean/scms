"""Seed the database with the demo accounts and clearance records.

The data mirrors the original browser mock so the demo experience is unchanged
after switching to the real API.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import (
    AuditLog,
    ClearanceRequest,
    ClearanceTask,
    Counter,
    Department,
    Document,
    Notification,
    Payment,
    TaskEvent,
    User,
)
from .security import hash_password

YEAR = datetime.now(timezone.utc).year
_HASH_CACHE: dict[str, str] = {}


def _hash(password: str) -> str:
    if password not in _HASH_CACHE:
        _HASH_CACHE[password] = hash_password(password)
    return _HASH_CACHE[password]


def _ago(days: int, hours: int = 0) -> str:
    moment = datetime.now(timezone.utc) - timedelta(days=days, hours=hours)
    return moment.isoformat(timespec="seconds")


def _task(
    task_id: str,
    request_id: str,
    department_id: str,
    status: str,
    *,
    officer_id: str | None = None,
    decided_days: int | None = None,
    comment: str = "",
    events: list[tuple[int, str, str, str]] | None = None,
) -> ClearanceTask:
    task = ClearanceTask(
        id=task_id,
        request_id=request_id,
        department_id=department_id,
        status=status,
        comment=comment,
        officer_id=officer_id,
        decided_at=_ago(decided_days) if decided_days is not None else None,
    )
    for index, (days, event_status, by, note) in enumerate(events or []):
        task.events.append(
            TaskEvent(
                id=f"ev_seed_{task_id}_{index}",
                at=_ago(days),
                status=event_status,
                by_name=by,
                note=note,
            )
        )
    return task


def seed_database(db: Session) -> bool:
    """Insert demo data when the database is empty. Returns True when seeded."""
    if db.scalar(select(func.count()).select_from(User)):
        return False

    departments = [
        Department(id="dep_lib", code="LIB", name="Library", description="Return of borrowed books and settlement of library fines.", requires_payment=False, fee=0, active=True),
        Department(id="dep_fin", code="FIN", name="Finance", description="Tuition balance and clearance fee settlement.", requires_payment=True, fee=10000, active=True),
        Department(id="dep_aca", code="ACA", name="Academic Department", description="Confirmation of completed modules and academic records.", requires_payment=False, fee=0, active=True),
        Department(id="dep_ict", code="ICT", name="ICT", description="Return of ICT equipment and deactivation of lab accounts.", requires_payment=False, fee=0, active=True),
    ]
    db.add_all(departments)

    officer_pw = _hash("Officer@123")
    student_pw = _hash("Student@123")
    users = [
        User(id="u_admin", role="admin", name="System Administrator", email="admin@mclears.ac", password_hash=_hash("Admin@123"), active=True, created_at=_ago(60)),
        User(id="u_off_lib", role="officer", name="Grace Mukamana", email="library@mclears.ac", department_id="dep_lib", password_hash=officer_pw, active=True, created_at=_ago(55)),
        User(id="u_off_fin", role="officer", name="Eric Habimana", email="finance@mclears.ac", department_id="dep_fin", password_hash=officer_pw, active=True, created_at=_ago(55)),
        User(id="u_off_aca", role="officer", name="Diane Uwase", email="academic@mclears.ac", department_id="dep_aca", password_hash=officer_pw, active=True, created_at=_ago(55)),
        User(id="u_off_ict", role="officer", name="Patrick Niyonzima", email="ict@mclears.ac", department_id="dep_ict", password_hash=officer_pw, active=True, created_at=_ago(55)),
        User(id="u_stu1", role="student", name="Jean Paul Demo", email="student@mclears.ac", student_number="2023/BSE/014", programme="BSc Software Engineering", faculty="Computing & IT", year_of_study="3", phone="+250 788 000 001", password_hash=student_pw, active=True, created_at=_ago(30)),
        User(id="u_stu2", role="student", name="Alice Ingabire", email="alice@mclears.ac", student_number="2022/BIT/007", programme="BSc Information Technology", faculty="Computing & IT", year_of_study="4", phone="+250 788 000 002", password_hash=student_pw, active=True, created_at=_ago(40)),
        User(id="u_stu3", role="student", name="Samuel Mugisha", email="samuel@mclears.ac", student_number="2021/BBA/031", programme="Bachelor of Business Administration", faculty="Business", year_of_study="4", phone="+250 788 000 003", password_hash=student_pw, active=True, created_at=_ago(45)),
        User(id="u_stu4", role="student", name="Claudine Iradukunda", email="claudine@mclears.ac", student_number="2022/BSE/022", programme="BSc Software Engineering", faculty="Computing & IT", year_of_study="4", phone="+250 788 000 004", password_hash=student_pw, active=True, created_at=_ago(20)),
    ]
    db.add_all(users)

    db.add_all(
        [
            ClearanceRequest(
                id="req_seed_a",
                ref=f"CLR-{YEAR}-0001",
                student_id="u_stu2",
                reason="Graduation",
                created_at=_ago(6),
                updated_at=_ago(1),
                student_number="2022/BIT/007",
                programme="BSc Information Technology",
                faculty="Computing & IT",
                year_of_study="4",
                phone="+250 788 000 002",
                notes="Clearing for graduation ceremony.",
            ),
            ClearanceRequest(
                id="req_seed_b",
                ref=f"CLR-{YEAR}-0002",
                student_id="u_stu3",
                reason="Graduation",
                created_at=_ago(14),
                updated_at=_ago(8),
                student_number="2021/BBA/031",
                programme="Bachelor of Business Administration",
                faculty="Business",
                year_of_study="4",
                phone="+250 788 000 003",
                notes="",
                certificate_number=f"MCL-CERT-{YEAR}-0002",
                certificate_code="K7P4-9QXM",
                certificate_issued_at=_ago(8),
            ),
            ClearanceRequest(
                id="req_seed_c",
                ref=f"CLR-{YEAR}-0003",
                student_id="u_stu4",
                reason="Transfer",
                created_at=_ago(1, 3),
                updated_at=_ago(1, 3),
                student_number="2022/BSE/022",
                programme="BSc Software Engineering",
                faculty="Computing & IT",
                year_of_study="4",
                phone="+250 788 000 004",
                notes="Transferring to another university.",
            ),
        ]
    )

    db.add_all(
        [
            Document(id="doc_a1", request_id="req_seed_a", name="library_card.pdf", content_type="application/pdf", size=84211, storage_name=None, uploaded_at=_ago(6)),
            Document(id="doc_c1", request_id="req_seed_c", name="transfer_letter.pdf", content_type="application/pdf", size=132004, storage_name=None, uploaded_at=_ago(1, 3)),
        ]
    )

    db.add_all(
        [
            Payment(id="pay_seed_a", request_id="req_seed_a", amount=10000, status="Paid", method="Mobile Money", tx_ref="SIM-7Q2K9X", paid_at=_ago(5), created_at=_ago(6)),
            Payment(id="pay_seed_b", request_id="req_seed_b", amount=10000, status="Paid", method="Card", tx_ref="SIM-3H8D1A", paid_at=_ago(13), created_at=_ago(14)),
            Payment(id="pay_seed_c", request_id="req_seed_c", amount=10000, status="Unpaid", created_at=_ago(1, 3)),
        ]
    )

    tasks = [
        _task("task_a_lib", "req_seed_a", "dep_lib", "Approved", officer_id="u_off_lib", decided_days=4, comment="No outstanding books.", events=[(4, "Approved", "Grace Mukamana", "No outstanding books.")]),
        _task("task_a_fin", "req_seed_a", "dep_fin", "Pending"),
        _task("task_a_aca", "req_seed_a", "dep_aca", "Approved", officer_id="u_off_aca", decided_days=3, events=[(3, "Approved", "Diane Uwase", "")]),
        _task("task_a_ict", "req_seed_a", "dep_ict", "Rejected", officer_id="u_off_ict", decided_days=1, comment="Laptop charger (asset ICT-0457) has not been returned.", events=[(1, "Rejected", "Patrick Niyonzima", "Laptop charger (asset ICT-0457) has not been returned.")]),
        _task("task_b_lib", "req_seed_b", "dep_lib", "Approved", officer_id="u_off_lib", decided_days=12, events=[(12, "Approved", "Grace Mukamana", "")]),
        _task("task_b_fin", "req_seed_b", "dep_fin", "Approved", officer_id="u_off_fin", decided_days=11, events=[(11, "Approved", "Eric Habimana", "")]),
        _task("task_b_aca", "req_seed_b", "dep_aca", "Approved", officer_id="u_off_aca", decided_days=10, events=[(10, "Approved", "Diane Uwase", "")]),
        _task("task_b_ict", "req_seed_b", "dep_ict", "Approved", officer_id="u_off_ict", decided_days=9, events=[(9, "Approved", "Patrick Niyonzima", "")]),
        _task("task_c_lib", "req_seed_c", "dep_lib", "Pending"),
        _task("task_c_fin", "req_seed_c", "dep_fin", "Pending"),
        _task("task_c_aca", "req_seed_c", "dep_aca", "Pending"),
        _task("task_c_ict", "req_seed_c", "dep_ict", "Pending"),
    ]
    department_order = {department.id: index for index, department in enumerate(departments)}
    for task in tasks:
        task.position = department_order[task.department_id]
    db.add_all(tasks)

    db.add_all(
        [
            Notification(id="n1", user_id="u_stu1", title="Welcome to S-Clearance", message="Start your clearance by submitting a request from your dashboard.", link="/student/apply", read=False, created_at=_ago(0, 2)),
            Notification(id="n2", user_id="u_stu2", title="ICT rejected your clearance", message="Laptop charger (asset ICT-0457) has not been returned.", link="/student/requests/req_seed_a", read=False, created_at=_ago(1)),
            Notification(id="n_off0", user_id="u_off_lib", title="New clearance request", message="Claudine Iradukunda submitted CLR-%s-0003." % YEAR, link="/officer/requests/req_seed_c", read=False, created_at=_ago(1, 3)),
            Notification(id="n_off1", user_id="u_off_fin", title="New clearance request", message="Claudine Iradukunda submitted CLR-%s-0003." % YEAR, link="/officer/requests/req_seed_c", read=False, created_at=_ago(1, 3)),
            Notification(id="n_off2", user_id="u_off_aca", title="New clearance request", message="Claudine Iradukunda submitted CLR-%s-0003." % YEAR, link="/officer/requests/req_seed_c", read=False, created_at=_ago(1, 3)),
            Notification(id="n_off3", user_id="u_off_ict", title="New clearance request", message="Claudine Iradukunda submitted CLR-%s-0003." % YEAR, link="/officer/requests/req_seed_c", read=False, created_at=_ago(1, 3)),
        ]
    )

    db.add_all(
        [
            AuditLog(id="a1", at=_ago(14), actor_id="u_stu3", actor_name="Samuel Mugisha", action="REQUEST_SUBMITTED", entity_id="req_seed_b", details=f"CLR-{YEAR}-0002 submitted (Graduation)"),
            AuditLog(id="a2", at=_ago(8), actor_id="system", actor_name="System", action="CLEARANCE_COMPLETED", entity_id="req_seed_b", details=f"CLR-{YEAR}-0002 cleared; certificate MCL-CERT-{YEAR}-0002 issued"),
            AuditLog(id="a3", at=_ago(6), actor_id="u_stu2", actor_name="Alice Ingabire", action="REQUEST_SUBMITTED", entity_id="req_seed_a", details=f"CLR-{YEAR}-0001 submitted (Graduation)"),
            AuditLog(id="a4", at=_ago(5), actor_id="u_stu2", actor_name="Alice Ingabire", action="PAYMENT_COMPLETED", entity_id="req_seed_a", details="Paid 10000 via Mobile Money (SIM-7Q2K9X)"),
            AuditLog(id="a5", at=_ago(4), actor_id="u_off_lib", actor_name="Grace Mukamana", action="TASK_APPROVED", entity_id="req_seed_a", details=f"Library approved CLR-{YEAR}-0001"),
            AuditLog(id="a6", at=_ago(3), actor_id="u_off_aca", actor_name="Diane Uwase", action="TASK_APPROVED", entity_id="req_seed_a", details=f"Academic Department approved CLR-{YEAR}-0001"),
            AuditLog(id="a7", at=_ago(1), actor_id="u_off_ict", actor_name="Patrick Niyonzima", action="TASK_REJECTED", entity_id="req_seed_a", details=f"ICT rejected CLR-{YEAR}-0001: Laptop charger (asset ICT-0457) has not been returned."),
            AuditLog(id="a8", at=_ago(1, 3), actor_id="u_stu4", actor_name="Claudine Iradukunda", action="REQUEST_SUBMITTED", entity_id="req_seed_c", details=f"CLR-{YEAR}-0003 submitted (Transfer)"),
        ]
    )

    db.add(Counter(name="clearance_ref", value=3))
    db.commit()
    return True
