from .db import Base,engine,SessionLocal
from .models import User
from .core import pwd
from .main import create_zone,create_record
from .schemas import ZoneCreate,RecordIn
def run():
 Base.metadata.create_all(bind=engine);db=SessionLocal();u=db.query(User).filter_by(username='demo').first()
 if not u: u=User(username='demo',password_hash=pwd.hash('demo1234'));db.add(u);db.commit();db.refresh(u)
 if not u.zones:
  for n in ['example.com','api.example.com','dev.example.com']: create_zone(ZoneCreate(name=n),u,db)
  z=u.zones[0]
  samples=[('A',['192.0.2.1']),('AAAA',['2001:db8::1']),('CNAME',['www.example.com']),('TXT',['v=spf1 -all']),('MX',[{'priority':10,'host':'mail.example.com'}]),('NS',['ns1.example.com']),('PTR',['host.example.com']),('SRV',[{'priority':10,'weight':5,'port':443,'target':'svc.example.com'}]),('CAA',[{'flag':0,'tag':'issue','value':'letsencrypt.org'}])]
  for i,(t,v) in enumerate(samples): create_record(RecordIn(name=f'{t.lower()}{i}.example.com',type=t,values=v),z,db)
 db.close()
if __name__=='__main__':run()
