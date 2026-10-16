"""Store exact allocated-batch line cost; preserve historical configured snapshots."""
from alembic import op
import sqlalchemy as sa
revision="7ba1d85a24ef"
down_revision="0895e25ebd15"
branch_labels=None
depends_on=None
def upgrade():
    op.add_column("order_items",sa.Column("cost_total",sa.Numeric(12,2),server_default="0",nullable=False))
    op.add_column("order_items",sa.Column("cost_complete",sa.Boolean(),server_default=sa.false(),nullable=False))
    op.execute(sa.text("UPDATE order_items SET cost_total=cost*quantity, cost_complete=CASE WHEN cost>0 THEN true ELSE false END"))
def downgrade():
    op.drop_column("order_items","cost_complete")
    op.drop_column("order_items","cost_total")
