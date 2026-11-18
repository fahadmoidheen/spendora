"""add owner user_id to expenses and budgets

Every entry and budget now belongs to one user (the Auth0 user id). Rows
that existed before login was added get the placeholder "unassigned";
after your first login, give them to yourself with:

    flask assign-owner <your Auth0 user id>

Revision ID: 880734f0863d
Revises: a3fcded20c50
Create Date: 2026-11-17 05:12:08.269038

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '880734f0863d'
down_revision = 'a3fcded20c50'
branch_labels = None
depends_on = None

# Must match UNASSIGNED in app/commands.py.
UNASSIGNED = 'unassigned'


def upgrade():
    # Existing rows get the placeholder via a temporary server default, which
    # is dropped straight after: new rows must always name their owner.
    with op.batch_alter_table('budgets', schema=None) as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.String(length=128), nullable=False,
                                      server_default=UNASSIGNED))
        batch_op.alter_column('user_id', server_default=None)
        # "One budget per category" becomes "one per category, per user".
        batch_op.drop_constraint('budgets_category_key', type_='unique')
        batch_op.create_unique_constraint('uq_budgets_user_id_category', ['user_id', 'category'])

    with op.batch_alter_table('expenses', schema=None) as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.String(length=128), nullable=False,
                                      server_default=UNASSIGNED))
        batch_op.alter_column('user_id', server_default=None)
        batch_op.create_index('ix_expenses_user_id_expense_date', ['user_id', 'expense_date'], unique=False)


def downgrade():
    # Note: this merges every user's data back together, and fails if two
    # users have a budget for the same category.
    with op.batch_alter_table('expenses', schema=None) as batch_op:
        batch_op.drop_index('ix_expenses_user_id_expense_date')
        batch_op.drop_column('user_id')

    with op.batch_alter_table('budgets', schema=None) as batch_op:
        batch_op.drop_constraint('uq_budgets_user_id_category', type_='unique')
        batch_op.create_unique_constraint('budgets_category_key', ['category'])
        batch_op.drop_column('user_id')
