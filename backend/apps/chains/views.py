from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ChainSerializer, ContractDeploymentSerializer, SupportedTokenSerializer
from .services import ensure_coston2_config


class Coston2ConfigView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        chain, vault, gateway, token = ensure_coston2_config()
        return Response(
            {
                "chain": ChainSerializer(chain).data,
                "contracts": {
                    "vault": ContractDeploymentSerializer(vault).data,
                    "gateway": ContractDeploymentSerializer(gateway).data,
                },
                "token": SupportedTokenSerializer(token).data,
                "fcc": {
                    "tee_id": settings.ZALARY_TEE_ID,
                    "tee_signer_epoch": settings.ZALARY_TEE_SIGNER_EPOCH,
                    "proxy_url": settings.ZALARY_FCC_PROXY_URL,
                },
            }
        )
