from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from eth_abi import encode
from eth_account import Account as EthAccount
from eth_account.messages import encode_defunct
from eth_utils import keccak

from apps.accounts.models import Account
from apps.chains.services import ensure_coston2_config
from apps.employees.services import create_employee
from apps.institutions.models import Institution, InstitutionMember
from apps.payroll.models import PayrollEmployeeAllocation, PayrollRun

from apps.withdrawals.models import WithdrawalRequest
from apps.withdrawals.serializers import WithdrawalPrepareSerializer, WithdrawalSubmitSerializer
from apps.withdrawals.services import (
    WithdrawalFlowError,
    _normalize_employee_signature_for_tee,
    get_withdrawal_context,
    prepare_withdrawal,
    submit_withdrawal,
    withdrawal_auth_digest,
)


@override_settings(ZALARY_WITHDRAWAL_AUTH_TTL_SECONDS=600)
class WithdrawalFlowTests(TestCase):
    def setUp(self):
        self.employee_key = "0x" + "44" * 32
        self.employee_wallet = EthAccount.from_key(self.employee_key).address
        self.account = Account.objects.create_user(self.employee_wallet)
        self.hr = Account.objects.create_user(EthAccount.create().address)
        chain, vault, _, _ = ensure_coston2_config()
        self.institution = Institution.objects.create(
            name="Private Payroll Co",
            institution_address=self.hr.wallet_address,
            admin_address=self.hr.wallet_address,
            treasury_address=EthAccount.create().address,
            tax_vault_address=EthAccount.create().address,
            chain=chain,
            vault_address=vault.address,
            registration_status=Institution.RegistrationStatus.ACTIVE,
            is_registered_onchain=True,
            is_active_onchain=True,
            created_by=self.hr,
        )
        InstitutionMember.objects.create(
            institution=self.institution,
            account=self.hr,
            wallet_address=self.hr.wallet_address,
            role=InstitutionMember.Role.HR,
            status=InstitutionMember.Status.ACTIVE,
            approved_onchain=True,
        )
        self.employee = create_employee(
            actor=self.hr,
            institution=self.institution,
            auth_wallet=self.employee_wallet,
            name="Private Employee",
        )
        now = timezone.now()
        self.payroll = PayrollRun.objects.create(
            institution=self.institution,
            chain=chain,
            title="Active payroll",
            period_label="2026-08",
            funding_starts_at=now - timedelta(days=1),
            funding_deadline=now + timedelta(days=1),
            minimum_withdrawal_window_seconds=86400,
            settlement_grace_period_seconds=86400,
            metadata_hash="0x" + "11" * 32,
            private_ledger_root="0x" + "22" * 32,
            employee_count=1,
            employee_net_total="2000000",
            aggregate_tax_total="0",
            total_required="2000000",
            funded_amount="2000000",
            minimum_withdrawal_amount="1000000",
            status=PayrollRun.Status.ACTIVE,
            onchain_status=5,
            created_by=self.hr,
        )
        self.context = {
            "institution": self.institution.institution_address,
            "private_ledger_root": "0x" + "22" * 32,
            "stablecoin": "0xC1A5B41512496B80903D1f32d6dEa3a73212E71F",
            "stablecoin_decimals": 6,
            "status": 5,
            "withdrawal_deadline": int((now + timedelta(hours=2)).timestamp()),
            "settlement_deadline": int((now + timedelta(hours=3)).timestamp()),
            "pending_withdrawal_requests": 0,
            "minimum_withdrawal_amount": 1000000,
            "extension_id": 65828,
            "gateway": "0xFE9A84346A614599C9A0b5a1F444bd816a6C100A",
            "vault": "0xA5277D55a46514740b0C716C691d92b8D9E64e5E",
            "token": "0xC1A5B41512496B80903D1f32d6dEa3a73212E71F",
        }
        self.allocation = PayrollEmployeeAllocation(
            payroll_run=self.payroll,
            employee=self.employee,
        )
        self.allocation.set_authorized_amount(1000000)
        self.allocation.save()

    def test_auth_digest_matches_documented_encoding(self):
        expires_at = 2_000_000_000
        digest = withdrawal_auth_digest(
            chain_id=114,
            gateway=self.context["gateway"],
            vault=self.context["vault"],
            extension_id=65828,
            payroll_id=self.payroll.payroll_id,
            employee_ref=str(self.employee.employee_ref),
            destination=self.employee_wallet,
            amount=1000000,
            nonce=0,
            old_ledger_root=self.context["private_ledger_root"],
            expires_at=expires_at,
        )
        expected = keccak(
            encode(
                ["bytes32", "uint256", "address", "address", "uint256", "uint256", "bytes32", "address", "uint256", "uint256", "bytes32", "uint64"],
                [
                    keccak(text="ZALARY_FCC_WITHDRAWAL_AUTH_V1"),
                    114,
                    self.context["gateway"],
                    self.context["vault"],
                    65828,
                    self.payroll.payroll_id,
                    keccak(text=str(self.employee.employee_ref)),
                    self.employee_wallet,
                    1000000,
                    0,
                    bytes.fromhex(self.context["private_ledger_root"][2:]),
                    expires_at,
                ],
            )
        )
        self.assertEqual(digest, "0x" + expected.hex())

    def test_employee_signature_is_normalized_for_go_tee(self):
        signed = EthAccount.from_key(self.employee_key).sign_message(
            encode_defunct(primitive=b"\x99" * 32)
        )
        normalized = _normalize_employee_signature_for_tee(signed.signature.hex())
        self.assertIn(bytes.fromhex(normalized[2:])[64], (0, 1))

    @patch("apps.withdrawals.services._read_context")
    def test_prepare_withdrawal_binds_current_root_and_nonce_zero(self, mocked_context):
        mocked_context.return_value = self.context
        withdrawal = prepare_withdrawal(
            actor=self.account,
            payroll=self.payroll,
        )
        self.assertEqual(withdrawal.nonce, 0)
        self.assertEqual(withdrawal.old_ledger_root, self.context["private_ledger_root"])
        self.assertTrue(withdrawal.auth_digest.startswith("0x"))
        self.assertEqual(withdrawal.status, WithdrawalRequest.Status.SIGNATURE_PENDING)
        self.assertEqual(withdrawal.amount, "1000000")
        self.assertEqual(withdrawal.destination, self.employee_wallet)

    @patch("apps.withdrawals.services._read_context")
    def test_context_returns_authenticated_full_available_salary(self, mocked_context):
        mocked_context.return_value = self.context
        context = get_withdrawal_context(actor=self.account, payroll=self.payroll)
        self.assertEqual(context["available_withdrawal_amount"], "1000000")
        self.assertEqual(context["destination_wallet"], self.employee_wallet)
        self.assertGreater(context["authorization_expires_at"], int(timezone.now().timestamp()))

    @patch("apps.withdrawals.services._read_context")
    def test_prepare_withdrawal_rejects_below_minimum(self, mocked_context):
        mocked_context.return_value = self.context
        self.allocation.set_authorized_amount(999999)
        self.allocation.save(update_fields=["amount_ciphertext", "updated_at"])
        with self.assertRaisesMessage(WithdrawalFlowError, "below"):
            prepare_withdrawal(
                actor=self.account,
                payroll=self.payroll,
            )

    @patch("apps.withdrawals.services._read_context")
    def test_unfinished_withdrawal_blocks_parallel_nonce(self, mocked_context):
        mocked_context.return_value = self.context
        prepare_withdrawal(
            actor=self.account,
            payroll=self.payroll,
        )
        with self.assertRaisesMessage(WithdrawalFlowError, "unfinished"):
            prepare_withdrawal(
                actor=self.account,
                payroll=self.payroll,
            )

    @patch("apps.withdrawals.services._read_context")
    def test_wrong_employee_signature_is_rejected_before_encryption(self, mocked_context):
        mocked_context.return_value = self.context
        withdrawal = prepare_withdrawal(
            actor=self.account,
            payroll=self.payroll,
        )
        wrong = EthAccount.create().sign_message(
            encode_defunct(primitive=bytes.fromhex(withdrawal.auth_digest[2:]))
        )
        with self.assertRaisesMessage(WithdrawalFlowError, "does not match"):
            submit_withdrawal(
                actor=self.account,
                withdrawal=withdrawal,
                signature=wrong.signature.hex(),
            )

    def test_prepare_serializer_rejects_client_controlled_authorization_fields(self):
        serializer = WithdrawalPrepareSerializer(
            data={
                "payroll_id": self.payroll.pk,
                "amount": "1",
                "destination": EthAccount.create().address,
                "nonce": 9,
                "expires_at": 1,
                "employee_proof": ["0x" + "00" * 32],
                "payroll_root": "0x" + "00" * 32,
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("amount", serializer.errors)
        self.assertIn("destination", serializer.errors)
        self.assertIn("payroll_root", serializer.errors)

    def test_submit_serializer_rejects_altered_bound_fields(self):
        serializer = WithdrawalSubmitSerializer(
            data={"signature": "0x" + "11" * 65, "amount": "2"}
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("amount", serializer.errors)

    @patch("apps.withdrawals.services._read_context")
    def test_destination_alteration_is_rejected(self, mocked_context):
        mocked_context.return_value = self.context
        withdrawal = prepare_withdrawal(actor=self.account, payroll=self.payroll)
        signed = EthAccount.from_key(self.employee_key).sign_message(
            encode_defunct(primitive=bytes.fromhex(withdrawal.auth_digest[2:]))
        )
        withdrawal.destination = EthAccount.create().address
        withdrawal.save(update_fields=["destination", "updated_at"])
        with self.assertRaisesMessage(WithdrawalFlowError, "destination"):
            submit_withdrawal(
                actor=self.account,
                withdrawal=withdrawal,
                signature=signed.signature.hex(),
            )

    @patch("apps.withdrawals.services._read_context")
    def test_amount_alteration_is_rejected(self, mocked_context):
        mocked_context.return_value = self.context
        withdrawal = prepare_withdrawal(actor=self.account, payroll=self.payroll)
        signed = EthAccount.from_key(self.employee_key).sign_message(
            encode_defunct(primitive=bytes.fromhex(withdrawal.auth_digest[2:]))
        )
        withdrawal.amount = "999999"
        withdrawal.save(update_fields=["amount", "updated_at"])
        with self.assertRaisesMessage(WithdrawalFlowError, "full authorized"):
            submit_withdrawal(
                actor=self.account,
                withdrawal=withdrawal,
                signature=signed.signature.hex(),
            )

    @patch("apps.withdrawals.services._read_context")
    def test_expired_withdrawal_is_rejected(self, mocked_context):
        mocked_context.return_value = self.context
        withdrawal = prepare_withdrawal(actor=self.account, payroll=self.payroll)
        withdrawal.expires_at = timezone.now() - timedelta(seconds=1)
        withdrawal.save(update_fields=["expires_at", "updated_at"])
        signed = EthAccount.from_key(self.employee_key).sign_message(
            encode_defunct(primitive=bytes.fromhex(withdrawal.auth_digest[2:]))
        )
        with self.assertRaisesMessage(WithdrawalFlowError, "expired"):
            submit_withdrawal(
                actor=self.account,
                withdrawal=withdrawal,
                signature=signed.signature.hex(),
            )

    @patch("apps.withdrawals.services._read_context")
    def test_second_withdrawal_after_finalization_is_rejected(self, mocked_context):
        mocked_context.return_value = self.context
        withdrawal = prepare_withdrawal(actor=self.account, payroll=self.payroll)
        withdrawal.status = WithdrawalRequest.Status.FINALIZED
        withdrawal.save(update_fields=["status", "updated_at"])
        with self.assertRaisesMessage(WithdrawalFlowError, "already been withdrawn"):
            prepare_withdrawal(actor=self.account, payroll=self.payroll)
