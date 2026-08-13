from django.shortcuts import get_object_or_404
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChainTransaction
from .serializers import ChainTransactionSerializer
from .services import sync_transaction


class TransactionListView(ListAPIView):
    serializer_class = ChainTransactionSerializer

    def get_queryset(self):
        return ChainTransaction.objects.select_related("chain", "prepared").filter(
            prepared__created_by=self.request.user
        )


class TransactionDetailView(RetrieveAPIView):
    serializer_class = ChainTransactionSerializer

    def get_queryset(self):
        return ChainTransaction.objects.select_related("chain", "prepared").filter(
            prepared__created_by=self.request.user
        )


class TransactionSyncView(APIView):
    def post(self, request, pk: int):
        chain_tx = get_object_or_404(
            ChainTransaction.objects.select_related("chain", "prepared"),
            pk=pk,
            prepared__created_by=request.user,
        )
        sync_transaction(chain_tx)
        chain_tx.refresh_from_db()
        return Response(ChainTransactionSerializer(chain_tx).data)
