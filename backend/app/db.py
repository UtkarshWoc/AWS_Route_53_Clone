import os
import ssl
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./app.db')

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

connect_args = {'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}
if 'aivencloud' in DATABASE_URL:
    connect_args['ssl'] = ssl_context

engine = create_engine(DATABASE_URL, connect_args=connect_args)
@event.listens_for(engine, 'connect')
def foreign_keys(dbapi_connection, _):
    if DATABASE_URL.startswith('sqlite'): dbapi_connection.execute('PRAGMA foreign_keys=ON')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
class Base(DeclarativeBase): pass
def get_db():
    db=SessionLocal()
    try: yield db
    finally: db.close()
