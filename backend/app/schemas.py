import ipaddress
import re
from pydantic import BaseModel, Field, model_validator
from typing import Literal, Any

HOSTNAME=re.compile(r'^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$')

class Login(BaseModel): username:str; password:str
class ZoneCreate(BaseModel): name:str; comment:str|None=None; type:Literal['public','private']='public'
class ZoneUpdate(BaseModel): comment:str|None=None
class RecordIn(BaseModel):
    name:str; type:Literal['A','AAAA','CNAME','TXT','MX','NS','PTR','SRV','CAA','SOA']; ttl:int=Field(default=300,ge=1,le=2147483647); values:list[Any]=Field(min_length=1); routing_policy:str='Simple'

    @model_validator(mode='after')
    def validate_values(self):
        validate_values(self.type,self.values)
        return self

class RecordUpdate(BaseModel):
    name:str; ttl:int=Field(default=300,ge=1); values:list[Any]=Field(min_length=1); routing_policy:str='Simple'; type:str|None=None

    @model_validator(mode='after')
    def validate_values(self):
        if self.type and self.type not in {'A','AAAA','CNAME','TXT','MX','NS','PTR','SRV','CAA','SOA'}:
            raise ValueError('Unsupported record type.')
        return self

def validate_values(record_type:str, values:list[Any]):
    if record_type in {'A','AAAA','CNAME','PTR','TXT','NS'} and not all(isinstance(value,str) for value in values):
        raise ValueError(f'{record_type} values must be strings.')
    if record_type == 'A' and not all(isinstance(ipaddress.ip_address(value),ipaddress.IPv4Address) for value in values):
        raise ValueError('A values must be IPv4 addresses.')
    if record_type == 'AAAA' and not all(isinstance(ipaddress.ip_address(value),ipaddress.IPv6Address) for value in values):
        raise ValueError('AAAA values must be IPv6 addresses.')
    if record_type in {'CNAME','PTR'} and (len(values) != 1 or not HOSTNAME.fullmatch(values[0].lower().removesuffix('.'))):
        raise ValueError(f'{record_type} requires one valid hostname.')
    if record_type == 'NS' and not all(HOSTNAME.fullmatch(value.lower().removesuffix('.')) for value in values):
        raise ValueError('NS values must be valid hostnames.')
    if record_type == 'MX' and not all(isinstance(value,dict) and isinstance(value.get('priority'),int) and isinstance(value.get('host'),str) and HOSTNAME.fullmatch(value['host'].lower().removesuffix('.')) for value in values):
        raise ValueError('MX values must contain priority and host.')
    if record_type == 'SRV' and not all(isinstance(value,dict) and all(isinstance(value.get(key),int) for key in ('priority','weight','port')) and 1 <= value['port'] <= 65535 and isinstance(value.get('target'),str) and HOSTNAME.fullmatch(value['target'].lower().removesuffix('.')) for value in values):
        raise ValueError('SRV values must contain valid priority, weight, port, and target.')
    if record_type == 'CAA' and not all(isinstance(value,dict) and isinstance(value.get('flag'),int) and value.get('tag') in {'issue','issuewild','iodef'} and isinstance(value.get('value'),str) for value in values):
        raise ValueError('CAA values must contain flag, tag, and value.')
