from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db import get_db
from app.models.credential import Credential
from app.schemas.credential import CredentialCreate, CredentialResponse

router = APIRouter(prefix="/credentials", tags=["credentials"])

@router.get("", response_model=List[CredentialResponse])
def get_credentials(db: Session = Depends(get_db)):
    return db.query(Credential).order_by(Credential.id).all()

@router.post("", response_model=CredentialResponse)
def create_credential(data: CredentialCreate, db: Session = Depends(get_db)):
    cred = Credential(**data.model_dump())
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return cred

@router.delete("/{cred_id}")
def delete_credential(cred_id: int, db: Session = Depends(get_db)):
    db.query(Credential).filter(Credential.id == cred_id).delete()
    db.commit()
    return {"success": True}
