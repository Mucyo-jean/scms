import shutil

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import IS_DEVELOPMENT, STORAGE_DIR
from ..database import Base, get_db
from ..seed import seed_database

router = APIRouter(prefix="/dev", tags=["development"])


@router.post("/reset")
def reset_demo_data(db: Session = Depends(get_db)):
    """Wipe and re-seed the demo database. Only available in development."""
    if not IS_DEVELOPMENT:
        raise HTTPException(status_code=404, detail="Not found.")

    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()
    seed_database(db)

    if STORAGE_DIR.exists():
        for item in STORAGE_DIR.iterdir():
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
    return {"ok": True, "detail": "Demo data reset to its initial state."}
