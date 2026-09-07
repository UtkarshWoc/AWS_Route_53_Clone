"""initial Route 53 clone schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-07
"""
from alembic import op
import sqlalchemy as sa
revision='0001_initial';down_revision=None;branch_labels=None;depends_on=None
def upgrade():
 op.create_table('users',sa.Column('id',sa.Integer(),primary_key=True),sa.Column('username',sa.String(100),nullable=False),sa.Column('password_hash',sa.String(255),nullable=False),sa.Column('created_at',sa.DateTime(),nullable=False));op.create_index('ix_users_username','users',['username'],unique=True)
 op.create_table('sessions',sa.Column('id',sa.Integer(),primary_key=True),sa.Column('user_id',sa.Integer(),sa.ForeignKey('users.id'),nullable=False),sa.Column('token_hash',sa.String(64),nullable=False),sa.Column('created_at',sa.DateTime(),nullable=False),sa.Column('expires_at',sa.DateTime(),nullable=False));op.create_index('ix_sessions_token_hash','sessions',['token_hash'],unique=True)
 op.create_table('hosted_zones',sa.Column('id',sa.Integer(),primary_key=True),sa.Column('user_id',sa.Integer(),sa.ForeignKey('users.id'),nullable=False),sa.Column('name',sa.String(253),nullable=False),sa.Column('comment',sa.Text()),sa.Column('type',sa.String(10),nullable=False),sa.Column('created_at',sa.DateTime(),nullable=False),sa.Column('updated_at',sa.DateTime(),nullable=False),sa.UniqueConstraint('user_id','name',name='uq_user_zone_name'))
 op.create_table('dns_records',sa.Column('id',sa.Integer(),primary_key=True),sa.Column('hosted_zone_id',sa.Integer(),sa.ForeignKey('hosted_zones.id',ondelete='CASCADE'),nullable=False),sa.Column('name',sa.String(253),nullable=False),sa.Column('type',sa.String(10),nullable=False),sa.Column('ttl',sa.Integer(),nullable=False),sa.Column('values',sa.JSON(),nullable=False),sa.Column('routing_policy',sa.String(30),nullable=False),sa.Column('is_default',sa.Boolean(),nullable=False),sa.Column('created_at',sa.DateTime(),nullable=False),sa.Column('updated_at',sa.DateTime(),nullable=False))
def downgrade():op.drop_table('dns_records');op.drop_table('hosted_zones');op.drop_table('sessions');op.drop_table('users')
