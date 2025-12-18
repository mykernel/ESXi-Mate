from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class CredentialBase(BaseModel):
    name: str
    username: str
    description: Optional[str] = None

class CredentialCreate(CredentialBase):
    password: str

class CredentialResponse(CredentialBase):
    id: int
    created_at: datetime
    # usually we don't return password, but frontend needs it to fill the install modal?
    # Or backend uses it directly.
    # The requirement is "manage passwords". If we want to "use" it in One-Click Install,
    # we can either pass credential_id to backend, OR return password to frontend (less secure).
    # Given the existing "manual input" flow, passing credential_id is cleaner.
    # But for "management", maybe seeing it? Let's hide it in list for security.

    class Config:
        from_attributes = True
