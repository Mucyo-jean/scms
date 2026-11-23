"""Serializers producing the camelCase JSON shape the React client consumes."""

from .models import (
    AuditLog,
    ClearanceRequest,
    ClearanceTask,
    Department,
    Document,
    Notification,
    Payment,
    User,
)
from .utils import overall_status


def user_public(user: User | None) -> dict | None:
    if user is None:
        return None
    return {
        "id": user.id,
        "role": user.role,
        "name": user.name,
        "email": user.email,
        "active": user.active,
        "createdAt": user.created_at,
        "departmentId": user.department_id,
        "studentNumber": user.student_number,
        "programme": user.programme,
        "faculty": user.faculty,
        "yearOfStudy": user.year_of_study,
        "phone": user.phone,
    }


def department_public(department: Department) -> dict:
    return {
        "id": department.id,
        "code": department.code,
        "name": department.name,
        "description": department.description,
        "requiresPayment": department.requires_payment,
        "fee": department.fee,
        "active": department.active,
    }


def document_public(document: Document) -> dict:
    return {
        "id": document.id,
        "name": document.name,
        "type": document.content_type,
        "size": document.size,
        "uploadedAt": document.uploaded_at,
        # The client fetches this URL with its bearer token. Seeded demo rows
        # have no stored file, so they intentionally get no URL.
        "url": f"/api/documents/{document.id}" if document.storage_name else None,
        "dataUrl": None,
        "hasFile": bool(document.storage_name),
    }


def payment_public(payment: Payment | None) -> dict | None:
    if payment is None:
        return None
    return {
        "amount": payment.amount,
        "status": payment.status,
        "method": payment.method,
        "txRef": payment.tx_ref,
        "paidAt": payment.paid_at,
    }


def task_public(task: ClearanceTask) -> dict:
    return {
        "departmentId": task.department_id,
        "status": task.status,
        "comment": task.comment,
        "officerId": task.officer_id,
        "decidedAt": task.decided_at,
        "history": [
            {"at": event.at, "status": event.status, "by": event.by_name, "note": event.note}
            for event in task.events
        ],
    }


def request_public(request: ClearanceRequest) -> dict:
    tasks = [task_public(task) for task in request.tasks]
    return {
        "id": request.id,
        "ref": request.ref,
        "studentId": request.student_id,
        "reason": request.reason,
        "createdAt": request.created_at,
        "updatedAt": request.updated_at,
        "form": {
            "studentNumber": request.student_number,
            "programme": request.programme,
            "faculty": request.faculty,
            "yearOfStudy": request.year_of_study,
            "phone": request.phone,
            "notes": request.notes,
        },
        "documents": [document_public(doc) for doc in request.documents],
        "payment": payment_public(request.payment),
        "tasks": tasks,
        "certificate": (
            {
                "number": request.certificate_number,
                "code": request.certificate_code,
                "issuedAt": request.certificate_issued_at,
            }
            if request.certificate_number
            else None
        ),
        "status": overall_status([task["status"] for task in tasks]),
    }


def notification_public(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "userId": notification.user_id,
        "title": notification.title,
        "message": notification.message,
        "link": notification.link,
        "read": notification.read,
        "createdAt": notification.created_at,
    }


def audit_public(entry: AuditLog) -> dict:
    return {
        "id": entry.id,
        "at": entry.at,
        "actorId": entry.actor_id,
        "actorName": entry.actor_name,
        "action": entry.action,
        "entityId": entry.entity_id,
        "details": entry.details,
    }
