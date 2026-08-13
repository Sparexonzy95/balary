from django.urls import path

from .views import TransactionDetailView, TransactionListView, TransactionSyncView

urlpatterns = [
    path("", TransactionListView.as_view(), name="transaction-list"),
    path("<int:pk>/", TransactionDetailView.as_view(), name="transaction-detail"),
    path("<int:pk>/sync/", TransactionSyncView.as_view(), name="transaction-sync"),
]
