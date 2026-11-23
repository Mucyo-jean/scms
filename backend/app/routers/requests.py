import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import ALLOWED_FILE_TYPES, CLEARANCE_REASONS, STORAGE_DIR
from ..database import get_db
from ..deps import get_current_user, require_officer, require_student
from ..models import (
    ClearanceRequest,
    ClearanceTask,
    Department,
    Document,
    Payment,
    User,
)
from ..schemas import DecisionIn, PaymentIn, RequestFormIn, ResubmitIn
from ..serialize import request_public
from ..services import (
    MAX_FILES,
    add_event,
    audit,
    complete_if_cleared,
    department_name,
    ensure_decision_allowed,
    next_counter,
    notify,
    notify_department_officers,
    open_request,
    validate_upload,
)
from ..utils import TASK_APPROVED, TASK_PENDING, TASK_REJECTED, new_id, now_iso, overall_status

router = APIRouter(prefix="/requests", tags=["clearance"])

PHONE_RE = re.compile(r"^\+?[\d\s-]{9,}$")


# ---------- helpers ----------


def get_request(db: Session, request_id: str) -> ClearanceRequest:
    request = db.get(ClearanceRequest, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found.")
    return request


def ensure_can_view(user: User, request: ClearanceRequest) -> None:
    if user.role == "admin" or request.student_id == user.id:
        return
    if user.role == "officer" and any(
        task.department_id == user.department_id for task in request.tasks
    ):
        return
    raise HTTPException(status_code=403, detail="You are not allowed to view this request.")


def _parse_form(payload: str) -> RequestFormIn:
    try:
        form = RequestFormIn.model_validate_json(payload)
    except ValidationError as exc:
        first = exc.errors()[0]
        field = ".".join(str(part) for part in first["loc"])
        raise HTTPException(status_code=400, detail=f"{field}: {first['msg']}") from exc
    if form.reason not in CLEARANCE_REASONS:
        raise HTTPException(status_code=400, detail="Select a valid purpose of clearance.")
    if not PHONE_RE.match(form.phone):
        raise HTTPException(status_code=400, detail="Enter a valid phone number.")
    if len(form.notes) > 500:
        raise HTTPException(status_code=400, detail="Notes cannot exceed 500 characters.")
    return form


async def _prepare_uploads(files: list[UploadFile], existing_count: int) -> list[tuple[str, bytes, str]]:
    if existing_count + len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400, detail=f"A request can have at most {MAX_FILES} documents."
        )
    prepared = []
    for upload in files:
        name = Path(upload.filename or "document").name
        data = await upload.read()
        error = validate_upload(upload.content_type, len(data), name)
        if error:
            raise HTTPException(status_code=400, detail=error)
        prepared.append((name, data, upload.content_type or "application/octet-stream"))
    return prepared


def _persist_documents(
    db: Session, request: ClearanceRequest, prepared: list[tuple[str, bytes, str]]
) -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    try:
        for name, data, content_type in prepared:
            storage_name = new_id() + ALLOWED_FILE_TYPES[content_type]
            path = STORAGE_DIR / storage_name
            path.write_bytes(data)
            written.append(path)
            document = Document(
                id=new_id("doc_"),
                request_id=request.id,
                name=name,
                content_type=content_type,
                size=len(data),
                storage_name=storage_name,
                uploaded_at=now_iso(),
            )
            db.add(document)
            request.documents.append(document)
    except OSError as exc:
        for path in written:
            path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Could not store the uploaded file.") from exc


# ---------- routes ----------


@router.get("")
def list_requests(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == "admin":
        requests = db.scalars(
            select(ClearanceRequest).order_by(ClearanceRequest.created_at.desc())
        ).all()
    elif user.role == "officer":
        requests = db.scalars(
            select(ClearanceRequest)
            .join(ClearanceTask)
            .where(ClearanceTask.department_id == user.department_id)
            .order_by(ClearanceRequest.created_at.desc())
        ).unique().all()
    else:
        requests = db.scalars(
            select(ClearanceRequest)
            .where(ClearanceRequest.student_id == user.id)
            .order_by(ClearanceRequest.created_at.desc())
        ).all()
    return [request_public(request) for request in requests]


@router.get("/{request_id}")
def get_one(
    request_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = get_request(db, request_id)
    ensure_can_view(user, request)
    return request_public(request)


@router.post("", status_code=201)
async def create_request(
    payload: str = Form(...),
    files: list[UploadFile] = File(default=[]),
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    form = _parse_form(payload)

    existing = open_request(db, user.id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"You already have an open clearance request ({existing.ref}).",
        )

    departments = db.scalars(select(Department).where(Department.active.is_(True))).all()
    if not departments:
        raise HTTPException(
            status_code=400, detail="No departments are currently accepting clearance requests."
        )

    prepared = await _prepare_uploads(files, 0)
    fee = sum(department.fee if department.requires_payment else 0 for department in departments)
    sequence = next_counter(db, "clearance_ref")
    year = datetime.now(timezone.utc).year
    reference = f"CLR-{year}-{sequence:04d}"

    request = ClearanceRequest(
        id=new_id("req_"),
        ref=reference,
        student_id=user.id,
        reason=form.reason,
        created_at=now_iso(),
        updated_at=now_iso(),
        student_number=form.studentNumber.strip(),
        programme=form.programme.strip(),
        faculty=form.faculty.strip(),
        year_of_study=form.yearOfStudy,
        phone=form.phone.strip(),
        notes=form.notes.strip(),
    )
    db.add(request)
    db.flush()

    for position, department in enumerate(departments):
        task = ClearanceTask(
            id=new_id("task_"),
            request_id=request.id,
            department_id=department.id,
            status=TASK_PENDING,
            position=position,
        )
        db.add(task)
        db.flush()
        add_event(db, task, "Submitted", user.name, "")

    if fee > 0:
        db.add(
            Payment(
                id=new_id("pay_"),
                request_id=request.id,
                amount=fee,
                status="Unpaid",
                created_at=now_iso(),
            )
        )

    _persist_documents(db, request, prepared)
    audit(
        db,
        user,
        "REQUEST_SUBMITTED",
        request.id,
        f"{reference} submitted ({form.reason}) with {len(prepared)} document(s)",
    )
    notify(
        db,
        user.id,
        "Clearance request submitted",
        f"{reference} was sent to {len(departments)} departments for review.",
        f"/student/requests/{request.id}",
    )
    for department in departments:
        notify_department_officers(
            db,
            department.id,
            "New clearance request",
            f"{user.name} submitted {reference}.",
            f"/officer/requests/{request.id}",
        )
    db.commit()
    db.refresh(request)
    return request_public(request)


@router.post("/{request_id}/documents")
async def add_documents(
    request_id: str,
    files: list[UploadFile] = File(...),
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    request = get_request(db, request_id)
    if request.student_id != user.id:
        raise HTTPException(status_code=403, detail="You are not allowed to modify this request.")
    if request.certificate_number:
        raise HTTPException(status_code=409, detail="This clearance is already completed.")
    prepared = await _prepare_uploads(files, len(request.documents))
    _persist_documents(db, request, prepared)
    request.updated_at = now_iso()
    audit(
        db,
        user,
        "DOCUMENT_UPLOADED",
        request.id,
        f"{', '.join(name for name, _, _ in prepared)} added to {request.ref}",
    )
    db.commit()
    return request_public(request)


@router.post("/{request_id}/resubmit")
def resubmit(
    request_id: str,
    data: ResubmitIn,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    request = get_request(db, request_id)
    if request.student_id != user.id:
        raise HTTPException(status_code=403, detail="You are not allowed to modify this request.")
    task = next(
        (item for item in request.tasks if item.department_id == data.departmentId), None
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Request not found.")
    if task.status != TASK_REJECTED:
        raise HTTPException(status_code=400, detail="Only rejected items can be resubmitted.")
    note = data.note.strip()
    if len(note) < 5:
        raise HTTPException(
            status_code=400, detail="Describe how you resolved the issue (at least 5 characters)."
        )

    task.status = TASK_PENDING
    add_event(db, task, "Resubmitted", user.name, note)
    request.updated_at = now_iso()

    audit(
        db,
        user,
        "TASK_RESUBMITTED",
        request.id,
        f"{request.ref} resubmitted to {department_name(db, task.department_id)}: {note}",
    )
    notify_department_officers(
        db,
        task.department_id,
        "Clearance item resubmitted",
        f"{user.name} resolved the issue on {request.ref}: “{note}”",
        f"/officer/requests/{request.id}",
    )
    db.commit()
    return request_public(request)


@router.post("/{request_id}/payment")
def pay(
    request_id: str,
    data: PaymentIn,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    request = get_request(db, request_id)
    if request.student_id != user.id:
        raise HTTPException(status_code=403, detail="You are not allowed to pay for this request.")
    payment = request.payment
    if payment is None:
        raise HTTPException(status_code=400, detail="No payment is required for this request.")
    if payment.status == "Paid":
        raise HTTPException(status_code=409, detail="This request has already been paid.")
    if data.method not in {"Mobile Money", "Card"}:
        raise HTTPException(status_code=400, detail="Choose a valid payment method.")

    if data.method == "Mobile Money":
        phone = str(data.details.get("phone", ""))
        if not PHONE_RE.match(phone):
            raise HTTPException(status_code=400, detail="Enter a valid mobile money number.")
        if re.sub(r"\D", "", phone).endswith("0000"):
            audit(db, user, "PAYMENT_FAILED", request.id, f"Simulated payment declined for {request.ref}")
            db.commit()
            raise HTTPException(
                status_code=402,
                detail="Payment declined by the simulated provider (numbers ending in 0000 always fail).",
            )

    payment.status = "Paid"
    payment.method = data.method
    payment.tx_ref = "SIM-" + new_id()[:6].upper()
    payment.paid_at = now_iso()
    request.updated_at = now_iso()

    audit(
        db,
        user,
        "PAYMENT_COMPLETED",
        request.id,
        f"Paid {payment.amount} RWF via {data.method} ({payment.tx_ref})",
    )
    notify(
        db,
        user.id,
        "Payment received",
        f"Your clearance fee for {request.ref} was paid. Reference {payment.tx_ref}.",
        f"/student/requests/{request.id}",
    )
    for department in db.scalars(select(Department).where(Department.requires_payment.is_(True))).all():
        notify_department_officers(
            db,
            department.id,
            "Clearance fee paid",
            f"{user.name} paid the clearance fee for {request.ref}.",
            f"/officer/requests/{request.id}",
        )
    db.commit()
    return request_public(request)["payment"]


@router.post("/{request_id}/decisions")
def decide(
    request_id: str,
    data: DecisionIn,
    officer: User = Depends(require_officer),
    db: Session = Depends(get_db),
):
    request = get_request(db, request_id)
    task = next(
        (item for item in request.tasks if item.department_id == officer.department_id), None
    )
    if task is None:
        raise HTTPException(
            status_code=403, detail="This request does not include your department."
        )
    if data.decision not in {TASK_APPROVED, TASK_REJECTED}:
        raise HTTPException(status_code=400, detail="Decision must be Approved or Rejected.")
    try:
        ensure_decision_allowed(db, task, data.decision, data.comment)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    comment = data.comment.strip()
    task.status = data.decision
    task.comment = comment
    task.officer_id = officer.id
    task.decided_at = now_iso()
    request.updated_at = now_iso()
    add_event(db, task, data.decision, officer.name, comment)

    department = department_name(db, task.department_id)
    if data.decision == TASK_APPROVED:
        audit(
            db,
            officer,
            "TASK_APPROVED",
            request.id,
            f"{department} approved {request.ref}{': ' + comment if comment else ''}",
        )
        notify(
            db,
            request.student_id,
            f"{department} approved your clearance",
            comment or f"{department} has cleared you.",
            f"/student/requests/{request.id}",
        )
        complete_if_cleared(db, request)
    else:
        audit(
            db,
            officer,
            "TASK_REJECTED",
            request.id,
            f"{department} rejected {request.ref}: {comment}",
        )
        notify(
            db,
            request.student_id,
            f"{department} rejected your clearance",
            comment,
            f"/student/requests/{request.id}",
        )

    db.commit()
    return request_public(request)


@router.get("/{request_id}/status")
def status(
    request_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = get_request(db, request_id)
    ensure_can_view(user, request)
    return {
        "ref": request.ref,
        "status": overall_status([task.status for task in request.tasks]),
        "tasks": [
            {"departmentId": task.department_id, "status": task.status} for task in request.tasks
        ],
    }
