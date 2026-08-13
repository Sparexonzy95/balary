from celery import shared_task

from .services import sync_pending_transactions


@shared_task
def sync_pending_chain_transactions(limit: int = 100):
    return sync_pending_transactions(limit=limit)
