from typing import Any

from pydantic import BaseModel, Field

CLEARANCE_REASONS = ["Graduation", "Transfer", "Withdrawal", "End of programme", "Deferral"]


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: str
    studentNumber: str = Field(min_length=1, max_length=40)
    programme: str = Field(min_length=1, max_length=160)
    faculty: str = Field(min_length=1, max_length=160)
    yearOfStudy: str = Field(min_length=1, max_length=10)
    phone: str = Field(min_length=7, max_length=40)
    password: str


class ProfileIn(BaseModel):
    name: str | None = None
    phone: str | None = None
    programme: str | None = None
    faculty: str | None = None
    yearOfStudy: str | None = None


class ChangePasswordIn(BaseModel):
    current: str
    next: str


class RequestFormIn(BaseModel):
    studentNumber: str = Field(min_length=1, max_length=40)
    programme: str = Field(min_length=1, max_length=160)
    faculty: str = Field(min_length=1, max_length=160)
    yearOfStudy: str = Field(min_length=1, max_length=10)
    phone: str = Field(min_length=7, max_length=40)
    notes: str = ""
    reason: str


class ResubmitIn(BaseModel):
    departmentId: str
    note: str


class PaymentIn(BaseModel):
    method: str
    details: dict[str, Any] = Field(default_factory=dict)


class DecisionIn(BaseModel):
    decision: str
    comment: str = ""


class AdminUserIn(BaseModel):
    role: str
    name: str
    email: str
    password: str
    departmentId: str | None = None


class AdminUserPatch(BaseModel):
    active: bool | None = None
    departmentId: str | None = None
    password: str | None = None


class DepartmentIn(BaseModel):
    id: str | None = None
    code: str
    name: str
    description: str = ""
    requiresPayment: bool = False
    fee: int | float = 0
    active: bool | None = None
