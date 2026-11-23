from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import ChangePasswordIn, LoginIn, ProfileIn, RegisterIn
from ..security import create_access_token, hash_password, verify_password
from ..serialize import user_public
from ..services import EMAIL_RE, audit, notify, validate_password
from ..utils import new_id, now_iso

router = APIRouter(prefix="/auth", tags=["auth"])


def _find_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def _token_response(user: User) -> dict:
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": user_public(user),
    }


@router.post("/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = _find_by_email(db, data.email)
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if not user.active:
        raise HTTPException(
            status_code=403,
            detail="This account has been deactivated. Contact the administrator.",
        )
    audit(db, user, "LOGIN", user.id, f"{user.email} signed in")
    db.commit()
    return _token_response(user)


@router.post("/register", status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    student_number = data.studentNumber.strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    password_error = validate_password(data.password)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    if db.scalar(select(User).where(User.student_number == student_number)):
        raise HTTPException(status_code=409, detail="This student number is already registered.")

    user = User(
        id=new_id("u_"),
        role="student",
        name=data.name.strip(),
        email=email,
        student_number=student_number,
        programme=data.programme.strip(),
        faculty=data.faculty.strip(),
        year_of_study=data.yearOfStudy,
        phone=data.phone.strip(),
        password_hash=hash_password(data.password),
        active=True,
        created_at=now_iso(),
    )
    db.add(user)
    db.flush()
    audit(db, user, "USER_REGISTERED", user.id, f"Student {user.name} ({user.student_number}) registered")
    notify(
        db,
        user.id,
        "Welcome to S-Clearance",
        "Start your clearance by submitting a request from your dashboard.",
        "/student/apply",
    )
    db.commit()
    return _token_response(user)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_public(user)


@router.patch("/profile")
def update_profile(
    data: ProfileIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.name is not None:
        if len(data.name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Name is too short.")
        user.name = data.name.strip()
    for field, value in (
        ("phone", data.phone),
        ("programme", data.programme),
        ("faculty", data.faculty),
        ("year_of_study", data.yearOfStudy),
    ):
        if value is not None:
            setattr(user, field, value.strip())
    audit(db, user, "PROFILE_UPDATED", user.id, f"{user.name} updated their profile")
    db.commit()
    return user_public(user)


@router.post("/change-password")
def change_password(
    data: ChangePasswordIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    password_error = validate_password(data.next)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)
    user.password_hash = hash_password(data.next)
    audit(db, user, "PASSWORD_CHANGED", user.id, f"{user.email} changed their password")
    db.commit()
    return {"ok": True}
