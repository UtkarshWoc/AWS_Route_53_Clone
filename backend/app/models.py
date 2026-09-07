from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Boolean, JSON, UniqueConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

class User(Base):
    __tablename__='users'; id:Mapped[int]=mapped_column(primary_key=True); username:Mapped[str]=mapped_column(String(100),unique=True,index=True); password_hash:Mapped[str]=mapped_column(String(255)); created_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)
    zones=relationship('HostedZone',back_populates='user',cascade='all, delete-orphan')
class Session(Base):
    __tablename__='sessions'; id:Mapped[int]=mapped_column(primary_key=True); user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True); token_hash:Mapped[str]=mapped_column(String(64),unique=True,index=True); created_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow); expires_at:Mapped[datetime]=mapped_column(DateTime)
class HostedZone(Base):
    __tablename__='hosted_zones'; __table_args__=(UniqueConstraint('user_id','name',name='uq_user_zone_name'),)
    id:Mapped[int]=mapped_column(primary_key=True); user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True); name:Mapped[str]=mapped_column(String(253)); comment:Mapped[str|None]=mapped_column(Text,nullable=True); type:Mapped[str]=mapped_column(String(10),default='public'); created_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow); updated_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow,onupdate=datetime.utcnow)
    user=relationship('User',back_populates='zones'); records=relationship('DnsRecord',back_populates='zone',cascade='all, delete-orphan')
class DnsRecord(Base):
    __tablename__='dns_records'; id:Mapped[int]=mapped_column(primary_key=True); hosted_zone_id:Mapped[int]=mapped_column(ForeignKey('hosted_zones.id',ondelete='CASCADE'),index=True); name:Mapped[str]=mapped_column(String(253)); type:Mapped[str]=mapped_column(String(10)); ttl:Mapped[int]=mapped_column(Integer,default=300); values:Mapped[list]=mapped_column(JSON); routing_policy:Mapped[str]=mapped_column(String(30),default='Simple'); is_default:Mapped[bool]=mapped_column(Boolean,default=False); created_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow); updated_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow,onupdate=datetime.utcnow)
    zone=relationship('HostedZone',back_populates='records')
