import os, ipaddress
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Response, Query, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from .db import Base,engine,get_db
from .models import User,Session as UserSession,HostedZone,DnsRecord
from .schemas import Login,ZoneCreate,ZoneUpdate,RecordIn,RecordUpdate
from .core import pwd,token,token_hash,expires,norm_name,error,HOST
from .deps import current_user,owned_zone

@asynccontextmanager
async def lifespan(app):
    # Schema ownership belongs to Alembic; this keeps production startup migration-safe.
    yield
app=FastAPI(title='Route 53 Clone API',lifespan=lifespan)
cors_origins=os.getenv('CORS_ORIGINS','http://localhost:3000').split(',')
if os.getenv('ENV')!='production':
    for local_origin in ('http://localhost:3001','http://localhost:3002'):
        if local_origin not in cors_origins: cors_origins.append(local_origin)
app.add_middleware(CORSMiddleware,allow_origins=cors_origins,allow_credentials=True,allow_methods=['*'],allow_headers=['*'])
@app.exception_handler(HTTPException)
async def handled(_,exc):
    detail=exc.detail if isinstance(exc.detail,dict) else {'code':'REQUEST_ERROR','message':str(exc.detail)}
    return JSONResponse(status_code=exc.status_code,content={'error':detail})
@app.exception_handler(RequestValidationError)
async def validation(_,exc):
    fields=[]
    for item in exc.errors():
        location='.'.join(str(part) for part in item.get('loc',[]) if part != 'body')
        fields.append(f'{location}: {item.get("msg", "Invalid value")}' if location else item.get('msg','Invalid value'))
    return JSONResponse(status_code=422,content={'error':{'code':'VALIDATION_ERROR','message':'; '.join(fields)}})
@app.exception_handler(Exception)
async def unexpected(_,exc):
    return JSONResponse(status_code=500,content={'error':{'code':'INTERNAL_ERROR','message':'An unexpected error occurred.'}})
def zone_out(z,db): return {'id':z.id,'name':z.name,'comment':z.comment,'type':z.type,'record_count':db.query(func.count(DnsRecord.id)).filter_by(hosted_zone_id=z.id).scalar(),'created_at':z.created_at,'updated_at':z.updated_at}
def record_out(r): return {'id':r.id,'name':r.name,'type':r.type,'ttl':r.ttl,'values':r.values,'routing_policy':r.routing_policy,'is_default':r.is_default,'created_at':r.created_at,'updated_at':r.updated_at}
def ordered(model,sort):
    columns={'name':model.name,'type':getattr(model,'type',model.name),'ttl':getattr(model,'ttl',model.name),'record_count':model.name}
    column=columns.get(sort.lstrip('-'),model.name)
    return column.desc() if sort.startswith('-') else column.asc()
@app.post('/api/auth/login')
def login(body:Login,response:Response,db:Session=Depends(get_db)):
    u=db.query(User).filter_by(username=body.username).first()
    if not u or not pwd.verify(body.password,u.password_hash): error(401,'INVALID_CREDENTIALS','The username or password is incorrect.')
    raw=token(); db.add(UserSession(user_id=u.id,token_hash=token_hash(raw),expires_at=expires())); db.commit(); 
    is_prod = os.getenv('ENV') == 'production'
    response.set_cookie('route53_session',raw,httponly=True,samesite='none' if is_prod else 'lax',max_age=86400,secure=is_prod)
    return {'username':u.username}
@app.post('/api/auth/logout',status_code=204)
def logout(request:Request, response:Response,user=Depends(current_user),db:Session=Depends(get_db)):
    db.query(UserSession).filter_by(id=request.state.session_id, user_id=user.id).delete(); db.commit();
    is_prod = os.getenv('ENV') == 'production'
    response.delete_cookie('route53_session', samesite='none' if is_prod else 'lax', secure=is_prod)
@app.get('/api/auth/me')
def me(user=Depends(current_user)): return {'id':user.id,'username':user.username}
@app.get('/api/hosted-zones')
def zones(q:str='',page:int=Query(1,ge=1),limit:int=Query(20,ge=1,le=100),sort:str='name',user=Depends(current_user),db:Session=Depends(get_db)):
    query=db.query(HostedZone).filter_by(user_id=user.id)
    if q: query=query.filter(HostedZone.name.contains(q.lower()))
    order=ordered(HostedZone,sort); total=query.count(); rows=query.order_by(order).offset((page-1)*limit).limit(limit).all()
    return {'items':[zone_out(x,db) for x in rows],'total':total,'page':page,'limit':limit}
@app.post('/api/hosted-zones',status_code=201)
def create_zone(body:ZoneCreate,user=Depends(current_user),db:Session=Depends(get_db)):
    name=norm_name(body.name)
    if db.query(HostedZone).filter_by(user_id=user.id,name=name).first(): error(409,'ZONE_NAME_TAKEN','A hosted zone with this domain name already exists.')
    z=HostedZone(user_id=user.id,name=name,comment=body.comment,type=body.type); db.add(z); db.flush();
    db.add_all([DnsRecord(hosted_zone_id=z.id,name=name,type='NS',ttl=172800,values=[f'ns-{n}.awsdns-{n}.com' for n in range(1,5)],is_default=True),DnsRecord(hosted_zone_id=z.id,name=name,type='SOA',ttl=900,values=[{'mname':'ns-1.awsdns-1.com','rname':'awsdns-hostmaster.amazon.com','serial':1,'refresh':7200,'retry':900,'expire':1209600,'minimum':300}],is_default=True)]); db.commit(); db.refresh(z); return zone_out(z,db)
@app.get('/api/hosted-zones/{zone_id}')
def get_zone(z=Depends(owned_zone),db:Session=Depends(get_db)): return zone_out(z,db)
@app.get('/api/hosted-zones/{zone_id}/export')
def export_zone(zone_id:int,format:str=Query('json',pattern='^(json|bind)$'),z=Depends(owned_zone),db:Session=Depends(get_db)):
    records=db.query(DnsRecord).filter_by(hosted_zone_id=z.id).order_by(DnsRecord.name.asc(),DnsRecord.type.asc()).all()
    if format=='json': return {'zone':zone_out(z,db),'records':[record_out(record) for record in records]}
    lines=[f'$ORIGIN {z.name}.', '$TTL 300']
    for record in records:
        for value in record.values:
            if record.type in ('A','AAAA','CNAME','TXT','NS','PTR'):
                rendered=f'"{value}"' if record.type=='TXT' else str(value)
            elif record.type=='MX': rendered=f"{value['priority']} {value['host']}"
            elif record.type=='SRV': rendered=f"{value['priority']} {value['weight']} {value['port']} {value['target']}"
            elif record.type=='CAA': rendered=f"{value['flag']} {value['tag']} \"{value['value']}\""
            elif record.type=='SOA': rendered=f"{value['mname']} {value['rname']} {value['serial']} {value['refresh']} {value['retry']} {value['expire']} {value['minimum']}"
            else: continue
            lines.append(f'{record.name}. {record.ttl} IN {record.type} {rendered}')
    return Response('\n'.join(lines)+'\n',media_type='text/dns')
@app.put('/api/hosted-zones/{zone_id}')
def update_zone(body:ZoneUpdate,z=Depends(owned_zone),db:Session=Depends(get_db)): z.comment=body.comment; db.commit(); db.refresh(z); return zone_out(z,db)
@app.delete('/api/hosted-zones/{zone_id}',status_code=204)
def delete_zone(z=Depends(owned_zone),db:Session=Depends(get_db)):
    if db.query(DnsRecord).filter_by(hosted_zone_id=z.id,is_default=False).count(): error(409,'HOSTED_ZONE_NOT_EMPTY','This hosted zone contains custom DNS records. Delete them before deleting the zone.')
    db.delete(z); db.commit()
def validate_record(b,creating=True):
    name=norm_name(b.name)
    if creating and b.type=='SOA': error(422,'VALIDATION_ERROR','SOA records are system-managed.')
    typ=getattr(b,'type',None); vals=b.values
    try:
      if typ=='A' and not all(isinstance(ipaddress.ip_address(x),ipaddress.IPv4Address) for x in vals): raise ValueError()
      if typ=='AAAA' and not all(isinstance(ipaddress.ip_address(x),ipaddress.IPv6Address) for x in vals): raise ValueError()
      if typ in ('CNAME','PTR') and (len(vals)!=1 or not HOST.fullmatch(vals[0].lower().removesuffix('.'))): raise ValueError()
      if typ=='NS' and not all(HOST.fullmatch(x.lower().removesuffix('.')) for x in vals): raise ValueError()
      if typ=='MX' and not all(isinstance(x,dict) and isinstance(x.get('priority'),int) and HOST.fullmatch(x.get('host','').lower().removesuffix('.')) for x in vals): raise ValueError()
      if typ=='SRV' and not all(isinstance(x,dict) and all(isinstance(x.get(k),int) for k in ('priority','weight','port')) and 1<=x['port']<=65535 and HOST.fullmatch(x.get('target','').lower().removesuffix('.')) for x in vals): raise ValueError()
      if typ=='CAA' and not all(isinstance(x,dict) and isinstance(x.get('flag'),int) and x.get('tag') in ('issue','issuewild','iodef') and isinstance(x.get('value'),str) for x in vals): raise ValueError()
    except (ValueError,TypeError,AttributeError,KeyError): error(422,'VALIDATION_ERROR',f'Invalid {typ} record value.')
    return name
@app.get('/api/hosted-zones/{zone_id}/records')
def records(q:str='',type:str='',page:int=Query(1,ge=1),limit:int=Query(20,ge=1,le=100),sort:str='name',z=Depends(owned_zone),db:Session=Depends(get_db)):
    query=db.query(DnsRecord).filter_by(hosted_zone_id=z.id)
    if q: query=query.filter(DnsRecord.name.contains(q.lower()))
    if type: query=query.filter_by(type=type)
    total=query.count(); order=ordered(DnsRecord,sort); rows=query.order_by(order).offset((page-1)*limit).limit(limit).all(); return {'items':[record_out(r) for r in rows],'total':total,'page':page,'limit':limit}
@app.post('/api/hosted-zones/{zone_id}/records',status_code=201)
def create_record(body:RecordIn,z=Depends(owned_zone),db:Session=Depends(get_db)):
    name=validate_record(body)
    existing=db.query(DnsRecord).filter_by(hosted_zone_id=z.id,name=name).all()
    if existing and (body.type=='CNAME' or any(r.type=='CNAME' for r in existing)): error(409,'CNAME_COLLISION','A CNAME record cannot coexist with another record type at this name.')
    r=DnsRecord(hosted_zone_id=z.id,name=name,type=body.type,ttl=body.ttl,values=body.values,routing_policy=body.routing_policy); db.add(r); db.commit(); db.refresh(r); return record_out(r)
@app.put('/api/hosted-zones/{zone_id}/records/{record_id}')
def update_record(body:RecordUpdate,record_id:int,z=Depends(owned_zone),db:Session=Depends(get_db)):
    r=db.query(DnsRecord).filter_by(id=record_id,hosted_zone_id=z.id).first()
    if not r: error(404,'RECORD_NOT_FOUND','DNS record was not found.')
    if r.is_default: error(409,'DEFAULT_RECORD_PROTECTED','Default NS and SOA records cannot be changed.')
    if body.type and body.type!=r.type: error(422,'VALIDATION_ERROR','Record type cannot be changed.')
    proxy=type('R',(),{'name':body.name,'type':r.type,'values':body.values})(); name=validate_record(proxy,False)
    others=db.query(DnsRecord).filter(DnsRecord.hosted_zone_id==z.id,DnsRecord.name==name,DnsRecord.id!=r.id).all()
    if others and (r.type=='CNAME' or any(x.type=='CNAME' for x in others)): error(409,'CNAME_COLLISION','A CNAME record cannot coexist with another record type at this name.')
    r.name=name;r.ttl=body.ttl;r.values=body.values;r.routing_policy=body.routing_policy;db.commit();db.refresh(r);return record_out(r)
@app.delete('/api/hosted-zones/{zone_id}/records/{record_id}',status_code=204)
def delete_record(record_id:int,z=Depends(owned_zone),db:Session=Depends(get_db)):
    r=db.query(DnsRecord).filter_by(id=record_id,hosted_zone_id=z.id).first()
    if not r: error(404,'RECORD_NOT_FOUND','DNS record was not found.')
    if r.is_default:error(409,'DEFAULT_RECORD_PROTECTED','Default NS and SOA records cannot be deleted.')
    db.delete(r);db.commit()
