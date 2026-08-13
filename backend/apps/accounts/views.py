from rest_framework import status
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import AccountSerializer, NonceRequestSerializer, VerifyRequestSerializer
from .services import WalletAuthError, create_login_nonce, verify_wallet_signature


class NonceView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = NonceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            nonce = create_login_nonce(serializer.validated_data["wallet_address"])
        except WalletAuthError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "wallet_address": nonce.wallet_address,
                "nonce": nonce.nonce,
                "message": nonce.message,
                "expires_at": nonce.expires_at,
            }
        )


class VerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            account = verify_wallet_signature(
                wallet_address=serializer.validated_data["wallet_address"],
                nonce_value=serializer.validated_data["nonce"],
                signature=serializer.validated_data["signature"],
            )
        except WalletAuthError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        refresh = RefreshToken.for_user(account)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "account": AccountSerializer(account).data,
            }
        )


class MeView(RetrieveUpdateAPIView):
    serializer_class = AccountSerializer

    def get_object(self):
        return self.request.user
