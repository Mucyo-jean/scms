import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_admin
from ..models import Department, User
from ..schemas import AdminUserIn, AdminUserPatch, DepartmentIn
from ..security import hash_password
from ..serialize import department_public, user_public
from ..services import EMAIL_RE, audit, department_name, validate_password
from ..utils import new_id, now_iso

router = APIRouter(tags=["administration"])

CODE_RE = re.compile(r"^[A-Za-z]{2,5}$")


@router.post("/users", status_code=201)
def create_staff(
    data: AdminUserIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if data.role not in {"officer", "admin"}:
        raise HTTPException(status_code=400, detail="Role must be officer or admin.")
    email = data.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    password_error = validate_password(data.password)
    if password_error:
        raise HTTPException(status_code=400, detail=f"Password: {password_error}")
    if data.role == "officer":
        if not data.departmentId:
            raise HTTPException(status_code=400, detail="Officers must be assigned to a department.")
        if db.get(Department, data.departmentId) is None:
            raise HTTPException(status_code=404, detail="Department not found.")

    user = User(
        id=new_id("u_"),
        role=data.role,
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password),
        active=True,
        created_at=now_iso(),
        department_id=data.departmentId if data.role == "officer" else None,
    )
    db.add(user)
    db.flush()
    suffix = f" ({department_name(db, user.department_id)})" if user.department_id else ""
    audit(db, admin, "USER_CREATED", user.id, f"Created {user.role} account {user.email}{suffix}")
    db.commit()
    return user_public(user)


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    data: AdminUserPatch,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    changes: list[str] = []
    if data.active is not None and data.active != user.active:
        if user.id == admin.id and data.active is False:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
        user.active = data.active
        changes.append("activated" if data.active else "deactivated")
    if data.departmentId and user.role == "officer" and data.departmentId != user.department_id:
        if db.get(Department, data.departmentId) is None:
            raise HTTPException(status_code=404, detail="Department not found.")
        user.department_id = data.departmentId
        changes.append("moved to " + department_name(db, data.departmentId))
    if data.password:
        password_error = validate_password(data.password)
        if password_error:
            raise HTTPException(status_code=400, detail=f"Password: {password_error}")
        user.password_hash = hash_password(data.password)
        changes.append("password reset")

    if changes:
        audit(db, admin, "USER_UPDATED", user.id, f"{user.email}: {', '.join(changes)}")
    db.commit()
    return user_public(user)


def _department_fields(data: DepartmentIn) -> dict:
    code = data.code.strip().upper()
    name = data.name.strip()
    if not CODE_RE.match(code):
        raise HTTPException(status_code=400, detail="Code must be 2–5 letters.")
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Enter a department name.")
    requires_payment = bool(data.requiresPayment)
    fee = max(0, int(data.fee or 0)) if requires_payment else 0
    return {
        "code": code,
        "name": name,
        "description": data.description.strip(),
        "requires_payment": requires_payment,
        "fee": fee,
    }


@router.post("/departments", status_code=201)
def create_department(
    data: DepartmentIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    fields = _department_fields(data)
    if db.scalar(select(Department).where(Department.code == fields["code"])):
        raise HTTPException(
            status_code=409, detail=f"Department code {fields['code']} is already in use."
        )
    department = Department(id=new_id("dep_"), active=True, **fields)
    db.add(department)
    db.flush()
    audit(db, admin, "DEPARTMENT_CREATED", department.id, f"Created department {department.name}")
    db.commit()
    return department_public(department)


@router.patch("/departments/{department_id}")
def update_department(
    department_id: str,
    data: DepartmentIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    department = db.get(Department, department_id)
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found.")
    fields = _department_fields(data)
    duplicate = db.scalar(
        select(Department).where(
            Department.code == fields["code"], Department.id != department_id
        )
    )
    if duplicate:
        raise HTTPException(
            status_code=409, detail=f"Department code {fields['code']} is already in use."
        )
    for key, value in fields.items():
        setattr(department, key, value)
    if data.active is not None:
        department.active = data.active
    audit(
        db,
        admin,
        "DEPARTMENT_UPDATED",
        department.id,
        f"Updated department {department.name} ({'active' if department.active else 'inactive'})",
    )
    db.commit()
    return department_public(department)
