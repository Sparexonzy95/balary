from celery import shared_task

from .services import process_pending_instructions


@shared_task
def process_pending_fcc_instructions(limit: int = 25):
    return process_pending_instructions(limit=limit)
