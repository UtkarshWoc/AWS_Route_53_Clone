import os
os.environ['DATABASE_URL']='sqlite:///./test.db'
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base,engine,SessionLocal
from app.models import User, HostedZone, DnsRecord
from app.core import pwd

def setup_module():
    Base.metadata.drop_all(engine);Base.metadata.create_all(engine)
    db=SessionLocal();db.add(User(username='tester',password_hash=pwd.hash('secret')));db.commit();db.close()
def test_login_zone_and_records():
    with TestClient(app) as c:
      assert c.post('/api/auth/login',json={'username':'tester','password':'secret'}).status_code==200
      z=c.post('/api/hosted-zones',json={'name':'example.test','type':'public'});assert z.status_code==201
      zid=z.json()['id'];assert c.get(f'/api/hosted-zones/{zid}/records').json()['total']==2
      a=c.post(f'/api/hosted-zones/{zid}/records',json={'name':'www.example.test','type':'A','ttl':300,'values':['192.0.2.1']});assert a.status_code==201
      assert c.delete(f'/api/hosted-zones/{zid}').status_code==409
      assert c.delete(f"/api/hosted-zones/{zid}/records/{a.json()['id']}").status_code==204
      assert c.delete(f'/api/hosted-zones/{zid}').status_code==204

def test_logout_invalidates_only_presented_session_and_isolation():
    with TestClient(app) as owner, TestClient(app) as other:
      assert owner.post('/api/auth/login',json={'username':'tester','password':'secret'}).status_code==200
      zone=owner.post('/api/hosted-zones',json={'name':'owner-only.test'}).json()
      db=SessionLocal(); outsider=User(username='outsider',password_hash=pwd.hash('secret')); db.add(outsider); db.commit(); db.close()
      assert other.post('/api/auth/login',json={'username':'outsider','password':'secret'}).status_code==200
      assert other.get(f"/api/hosted-zones/{zone['id']}").status_code==404
      old=owner.cookies.get('route53_session')
      assert owner.post('/api/auth/logout').status_code==204
      owner.cookies.set('route53_session',old)
      assert owner.get('/api/auth/me').status_code==401

def test_record_validation_and_cname_collision():
    samples={'A':['192.0.2.1'],'AAAA':['2001:db8::1'],'TXT':['text'],'MX':[{'priority':10,'host':'mail.test'}],'NS':['ns1.test'],'PTR':['host.test'],'SRV':[{'priority':1,'weight':2,'port':443,'target':'svc.test'}],'CAA':[{'flag':0,'tag':'issue','value':'ca.test'}]}
    with TestClient(app) as c:
      c.post('/api/auth/login',json={'username':'tester','password':'secret'})
      zone=c.post('/api/hosted-zones',json={'name':'records.test'}).json()['id']
      for kind,values in samples.items():
        response=c.post(f'/api/hosted-zones/{zone}/records',json={'name':f'{kind.lower()}.records.test','type':kind,'values':values})
        assert response.status_code==201, response.text
      assert c.post(f'/api/hosted-zones/{zone}/records',json={'name':'alias.records.test','type':'CNAME','values':['target.test']}).status_code==201
      assert c.post(f'/api/hosted-zones/{zone}/records',json={'name':'alias.records.test','type':'A','values':['192.0.2.2']}).status_code==409
      assert c.post(f'/api/hosted-zones/{zone}/records',json={'name':'bad.records.test','type':'A','values':['not-an-ip']}).status_code==422
      assert c.post(f'/api/hosted-zones/{zone}/records',json={'name':'soa.records.test','type':'SOA','values':[{}]}).status_code==422

def test_sqlite_foreign_key_cascade():
    db=SessionLocal()
    user=db.query(User).filter_by(username='tester').first()
    zone=HostedZone(user_id=user.id,name='cascade.test',type='public')
    db.add(zone);db.flush()
    db.add(DnsRecord(hosted_zone_id=zone.id,name='www.cascade.test',type='A',ttl=300,values=['192.0.2.9']))
    db.commit();zone_id=zone.id
    db.delete(zone);db.commit()
    assert db.query(DnsRecord).filter_by(hosted_zone_id=zone_id).count()==0
    db.close()

def test_zone_exports():
    with TestClient(app) as c:
      c.post('/api/auth/login',json={'username':'tester','password':'secret'})
      zone=c.post('/api/hosted-zones',json={'name':'export.test'}).json()['id']
      c.post(f'/api/hosted-zones/{zone}/records',json={'name':'www.export.test','type':'A','values':['192.0.2.20']})
      json_export=c.get(f'/api/hosted-zones/{zone}/export?format=json')
      bind_export=c.get(f'/api/hosted-zones/{zone}/export?format=bind')
      assert json_export.status_code==200 and any(item['type']=='A' for item in json_export.json()['records'])
      assert bind_export.status_code==200 and '$ORIGIN export.test.' in bind_export.text and 'IN A 192.0.2.20' in bind_export.text
