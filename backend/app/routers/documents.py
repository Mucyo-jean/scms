from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import STORAGE_DIR
from ..database import get_db
from ..deps import get_current_user
from ..models import Document, User

router = APIRouter(prefix="/documents", tags=["documents"])


def _can_access(user: User, document: Document) -> bool:
    request = document.request
    if user.role == "admin" or request.student_id == user.id:
        return True
    return user.role == "officer" and any(
        task.department_id == user.department_id for task in request.tasks
    )


@router.get("/{document_id}")
def download(
    document_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if not _can_access(user, document):
        raise HTTPException(status_code=403, detail="You are not allowed to view this document.")
    if not document.storage_name:
        raise HTTPException(
            status_code=404, detail="This seeded demo document has no stored file content."
        )
    path = STORAGE_DIR / document.storage_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="The stored file is missing.")
    # Serve PDFs as a generic byte stream: Chrome intercepts same-origin
    # `application/pdf` fetches (returning an empty 204), which breaks the
    # SPA's authenticated blob download. The client restores the real MIME
    # type from the document metadata before viewing the blob.
    media_type = (
        "application/octet-stream"
        if document.content_type == "application/pdf"
        else document.content_type
    )
    return FileResponse(
        path,
        media_type=media_type,
        filename=document.name,
        content_disposition_type="inline",
    )
