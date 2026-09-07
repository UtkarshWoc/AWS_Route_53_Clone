import os, re, secrets, hashlib, bcrypt
from datetime import datetime, timedelta
from fastapi import HTTPException
class Passwords:
    @staticmethod
    def hash(value): return bcrypt.hashpw(value.encode(), bcrypt.gensalt()).decode()
    @staticmethod
    def verify(value, hashed): return bcrypt.checkpw(value.encode(), hashed.encode())
pwd=Passwords(); HOST=re.compile(r'^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$')
def error(status,code,message): raise HTTPException(status_code=status,detail={'code':code,'message':message})
def norm_name(value):
    value=value.strip().lower().removesuffix('.')
    if not HOST.fullmatch(value): error(422,'VALIDATION_ERROR','Enter a valid domain or record name.')
    return value
def token(): return secrets.token_urlsafe(32)
def token_hash(raw): return hashlib.sha256(raw.encode()).hexdigest()
def expires(): return datetime.utcnow()+timedelta(hours=int(os.getenv('SESSION_TTL_HOURS','24')))
