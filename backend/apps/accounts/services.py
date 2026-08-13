from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from eth_account import Account as EthAccount
from eth_account.messages import encode_defunct
from eth_utils import is_address, to_checksum_address

from .models import Account, WalletNonce, ZERO_ADDRESS


class WalletAuthError(ValueError):
    pass


def normalize_address(address: str) -> str:
    if not isinstance(address, str) or not is_address(address):
        raise WalletAuthError("Invalid wallet address")
    checksum = to_checksum_address(address)
    if checksum == ZERO_ADDRESS:
        raise WalletAuthError("The zero address is not allowed")
    return checksum


@transaction.atomic
def create_login_nonce(wallet_address: str) -> WalletNonce:
    normalized = normalize_address(wallet_address)
    WalletNonce.objects.filter(wallet_address=normalized, used=False).update(
        used=True,
        used_at=timezone.now(),
    )
    nonce = WalletNonce.build(normalized)
    nonce.save()
    return nonce


@transaction.atomic
def verify_wallet_signature(wallet_address: str, nonce_value: str, signature: str) -> Account:
    normalized = normalize_address(wallet_address)
    try:
        nonce = WalletNonce.objects.select_for_update().get(
            wallet_address=normalized,
            nonce=nonce_value,
            used=False,
        )
    except WalletNonce.DoesNotExist as exc:
        raise WalletAuthError("No active nonce matches this request") from exc

    if nonce.is_expired:
        nonce.used = True
        nonce.used_at = timezone.now()
        nonce.save(update_fields=["used", "used_at"])
        raise WalletAuthError("Nonce expired")

    try:
        recovered = EthAccount.recover_message(
            encode_defunct(text=nonce.message),
            signature=signature,
        )
    except Exception as exc:
        raise WalletAuthError("Invalid signature") from exc

    if to_checksum_address(recovered) != normalized:
        raise WalletAuthError("Signature does not match wallet")

    nonce.used = True
    nonce.used_at = timezone.now()
    nonce.save(update_fields=["used", "used_at"])
    account, _ = Account.objects.get_or_create(wallet_address=normalized)
    return account
