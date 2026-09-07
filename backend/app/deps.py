from datetime import datetime
from fastapi import Depends, Request
from sqlalchemy.orm import Session
from .db import get_db
from .models import User, Session as UserSession, HostedZone
from .core import token_hash, error
def current_user(request:Request,db:Session=Depends(get_db)):
    raw=request.cookies.get('route53_session')
    if not raw: error(401,'SESSION_EXPIRED','Sign in to continue.')
    row=db.query(UserSession).filter_by(token_hash=token_hash(raw)).first()
    if not row or row.expires_at < datetime.utcnow():
        if row: db.delete(row); db.commit()
        error(401,'SESSION_EXPIRED','Your session has expired. Sign in again.')
    request.state.session_id = row.id
    return db.get(User,row.user_id)
def owned_zone(zone_id:int,user=Depends(current_user),db:Session=Depends(get_db)):
    z=db.get(HostedZone,zone_id)
    if not z or z.user_id!=user.id: error(404,'ZONE_NOT_FOUND','Hosted zone was not found.')
    return z
