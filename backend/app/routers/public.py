from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClearanceRequest
from ..serialize import request_public

router = APIRouter(tags=["public"])


@router.get("/verify/{code}")
def verify(code: str, db: Session = Depends(get_db)):
    needle = code.strip().upper()
    if not needle:
        raise HTTPException(status_code=404, detail="No matching certificate.")
    request = db.scalar(
        select(ClearanceRequest).where(
            (ClearanceRequest.certificate_code == needle)
            | (ClearanceRequest.certificate_number == needle)
        )
    )
    if request is None:
        raise HTTPException(status_code=404, detail="No matching certificate.")
    payload = request_public(request)
    return {
        "number": payload["certificate"]["number"],
        "code": payload["certificate"]["code"],
        "issuedAt": payload["certificate"]["issuedAt"],
        "ref": request.ref,
        "studentName": request.student.name,
        "studentNumber": request.student_number,
        "programme": request.programme,
        "reason": request.reason,
    }
