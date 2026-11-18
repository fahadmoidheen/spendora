"""Command-line tools: ``flask <command>``."""

import click
from sqlalchemy import func, select, update

from app.extensions import db
from app.models import Budget, Expense

# Owner given to rows that existed before login was added (see the
# "add owner user_id" migration).
UNASSIGNED = "unassigned"


def register_commands(app):
    @app.cli.command("assign-owner")
    @click.argument("user_id")
    def assign_owner(user_id):
        """Give entries and budgets from before login existed to USER_ID.

        USER_ID is your Auth0 user id, e.g. "google-oauth2|1098...". Find it
        in the Auth0 dashboard under User Management > Users, or in the
        app's account menu.
        """
        user_id = user_id.strip()
        if not user_id or user_id == UNASSIGNED:
            raise click.BadParameter("Give a real Auth0 user id.")

        entries = db.session.execute(
            update(Expense).where(Expense.user_id == UNASSIGNED).values(user_id=user_id)
        ).rowcount

        # Skip budgets whose category the user already has a budget for -
        # moving them would break "one budget per category".
        owned = select(Budget.category).where(Budget.user_id == user_id)
        budgets = db.session.execute(
            update(Budget)
            .where(Budget.user_id == UNASSIGNED, Budget.category.not_in(owned))
            .values(user_id=user_id)
        ).rowcount
        db.session.commit()

        click.echo(f"Gave {entries} entries and {budgets} budgets to {user_id}.")
        left = db.session.scalar(
            select(func.count()).select_from(Budget).where(Budget.user_id == UNASSIGNED)
        )
        if left:
            click.echo(
                f"{left} budget(s) left unassigned: you already have a budget "
                "for those categories."
            )
