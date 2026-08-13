import logging

from django.db.models import Q
from rest_framework.permissions import AllowAny
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.institutions.models import Institution
from apps.institutions.services import accessible_institutions

from .models import EmailDelivery, Notification, NotificationPreference
from .services import enqueue_email_delivery
from .serializers import EmailDeliverySerializer, NotificationPreferenceSerializer, NotificationSerializer
from .webhooks import (
    InvalidWebhookSignature,
    parse_webhook_json,
    process_resend_event,
    verify_resend_signature,
)

logger = logging.getLogger(__name__)


def notifications_for(account):
    wallet = getattr(account, "wallet_address", "")
    query = Q(account=account)
    if wallet:
        query |= Q(recipient_wallet__iexact=wallet)
    institution_ids = accessible_institutions(account).values_list("id", flat=True)
    query |= Q(institution_id__in=institution_ids, recipient_wallet="")
    return Notification.objects.filter(query).distinct().order_by("-created_at", "-id")


class NotificationListView(APIView):
    def get(self, request):
        queryset = notifications_for(request.user)
        unread = request.query_params.get("unread")
        category = request.query_params.get("category")
        if unread in {"1", "true", "yes"}:
            queryset = queryset.filter(read=False)
        if category:
            queryset = queryset.filter(category=category)
        return Response(NotificationSerializer(queryset[:250], many=True).data)




class NotificationUnreadCountView(APIView):
    def get(self, request):
        return Response({"unread": notifications_for(request.user).filter(read=False).count()})


class NotificationReadView(APIView):
    def post(self, request, pk: int):
        notification = get_object_or_404(notifications_for(request.user), pk=pk)
        notification.mark_read()
        return Response(NotificationSerializer(notification).data)


class NotificationReadAllView(APIView):
    def post(self, request):
        queryset = notifications_for(request.user).filter(read=False)
        count = 0
        for notification in queryset:
            notification.mark_read()
            count += 1
        return Response({"updated": count})


class NotificationPreferenceView(APIView):
    def _institution(self, request):
        institution_id = request.query_params.get("institution_id") or request.data.get("institution")
        if not institution_id:
            return None
        return get_object_or_404(accessible_institutions(request.user), pk=institution_id)

    def get(self, request):
        institution = self._institution(request)
        preference, _ = NotificationPreference.objects.get_or_create(
            account=request.user,
            institution=institution,
        )
        return Response(NotificationPreferenceSerializer(preference).data)

    def patch(self, request):
        institution = self._institution(request)
        preference, _ = NotificationPreference.objects.get_or_create(
            account=request.user,
            institution=institution,
        )
        serializer = NotificationPreferenceSerializer(preference, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(account=request.user, institution=institution)
        return Response(serializer.data)


class EmailDeliveryListView(APIView):
    def get(self, request):
        institution_ids = list(accessible_institutions(request.user).values_list("id", flat=True))
        queryset = EmailDelivery.objects.filter(
            Q(institution_id__in=institution_ids) | Q(notification__account=request.user)
        ).distinct()
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return Response(EmailDeliverySerializer(queryset[:250], many=True).data)


class EmailDeliveryRetryView(APIView):
    def post(self, request, pk: int):
        institution_ids = list(accessible_institutions(request.user).values_list("id", flat=True))
        delivery = get_object_or_404(
            EmailDelivery.objects.filter(
                Q(institution_id__in=institution_ids) | Q(notification__account=request.user)
            ).distinct(),
            pk=pk,
        )
        if delivery.status in {
            EmailDelivery.Status.SENDING,
            EmailDelivery.Status.ACCEPTED,
            EmailDelivery.Status.DELIVERED,
            EmailDelivery.Status.BOUNCED,
            EmailDelivery.Status.COMPLAINED,
            EmailDelivery.Status.REJECTED,
            EmailDelivery.Status.SKIPPED,
        }:
            return Response(
                {"detail": f"Delivery cannot be retried from status {delivery.status}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        delivery.status = EmailDelivery.Status.PENDING
        delivery.attempts = 0
        delivery.last_error = ""
        delivery.error_message = ""
        from django.utils import timezone
        delivery.next_attempt_at = timezone.now()
        delivery.save(update_fields=["status", "attempts", "last_error", "error_message", "next_attempt_at", "updated_at"])
        enqueue_email_delivery(delivery.id)
        delivery.refresh_from_db()
        return Response(EmailDeliverySerializer(delivery).data)


class ResendWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        body = request.body
        event_id = request.headers.get("svix-id", "")
        try:
            verify_resend_signature(
                body=body,
                event_id=event_id,
                timestamp=request.headers.get("svix-timestamp", ""),
                signature=request.headers.get("svix-signature", ""),
            )
            payload = parse_webhook_json(body)
        except InvalidWebhookSignature as exc:
            logger.warning("email_webhook provider=resend state=rejected exception_class=%s", exc.__class__.__name__)
            return Response({"detail": "Invalid webhook signature"}, status=status.HTTP_403_FORBIDDEN)
        except ValueError:
            return Response({"detail": "Invalid webhook payload"}, status=status.HTTP_400_BAD_REQUEST)

        result = process_resend_event(event_id=event_id, payload=payload)
        return Response(
            {
                "accepted": True,
                "duplicate": result.duplicate,
                "matched": result.matched,
            }
        )
