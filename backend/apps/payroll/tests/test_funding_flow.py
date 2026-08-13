from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from eth_account import Account as EthAccount
from web3 import Web3

from apps.accounts.models import Account
from apps.chains.services import ensure_coston2_config
from apps.institutions.models import Institution, InstitutionMember
from apps.payroll.models import PayrollRun
from apps.payroll.services import (
    PayrollFlowError,
    confirm_open_funding,
    prepare_funding,
    prepare_funding_approval,
    prepare_open_funding,
)


class PayrollFundingPreparationTests(TestCase):
    def setUp(self):
        self.wallet = EthAccount.create().address
        self.account = Account.objects.create_user(self.wallet)
        chain, vault, _, _ = ensure_coston2_config()
        self.institution = Institution.objects.create(
            name="Funding Co",
            institution_address=self.wallet,
            admin_address=self.wallet,
            treasury_address=EthAccount.create().address,
            tax_vault_address=EthAccount.create().address,
            chain=chain,
            vault_address=vault.address,
            registration_status=Institution.RegistrationStatus.ACTIVE,
            is_registered_onchain=True,
            is_active_onchain=True,
            created_by=self.account,
        )
        for role in [InstitutionMember.Role.HR, InstitutionMember.Role.FINANCE]:
            InstitutionMember.objects.create(
                institution=self.institution,
                account=self.account,
                wallet_address=self.wallet,
                role=role,
                status=InstitutionMember.Status.ACTIVE,
                approved_onchain=True,
            )
        start = timezone.now() + timedelta(hours=1)
        self.payroll = PayrollRun.objects.create(
            institution=self.institution,
            chain=chain,
            title="August payroll",
            period_label="2026-08",
            funding_starts_at=start,
            funding_deadline=start + timedelta(days=2),
            minimum_withdrawal_window_seconds=86400,
            settlement_grace_period_seconds=86400,
            metadata_hash="0x" + "11" * 32,
            employee_count=2,
            employee_net_total="1800000",
            aggregate_tax_total="200000",
            total_required="2000000",
            private_ledger_root="0x" + "22" * 32,
            status=PayrollRun.Status.COMPUTED,
            onchain_status=3,
            created_by=self.account,
        )

    def funding_context(self):
        return {
            "status": 4,
            "remaining_amount": "2000000",
            "vault_allowance": "2000000",
            "finance_balance": "5000000",
        }

    def test_open_funding_targets_vault(self):
        prepared = prepare_open_funding(actor=self.account, payroll=self.payroll)
        selector = Web3.keccak(text="openFunding(uint256)")[:4].hex()
        self.assertTrue(prepared.calldata.startswith(selector))
        self.assertEqual(prepared.value_wei, "0")
        self.assertEqual(prepared.metadata["payroll_id"], str(self.payroll.payroll_id))

    @patch("apps.payroll.services.get_funding_context")
    def test_approval_uses_exact_remaining_amount(self, mocked_context):
        mocked_context.return_value = self.funding_context()
        self.payroll.status = PayrollRun.Status.FUNDING_READY
        self.payroll.onchain_status = 4
        self.payroll.save(update_fields=["status", "onchain_status"])
        prepared = prepare_funding_approval(actor=self.account, payroll=self.payroll)
        selector = Web3.keccak(text="approve(address,uint256)")[:4].hex()
        self.assertTrue(prepared.calldata.startswith(selector))
        self.assertEqual(prepared.metadata["amount"], "2000000")
        self.assertEqual(prepared.contract_address, "0xC1A5B41512496B80903D1f32d6dEa3a73212E71F")

    @patch("apps.payroll.services.get_funding_context")
    def test_funding_uses_exact_remaining_amount(self, mocked_context):
        mocked_context.return_value = self.funding_context()
        self.payroll.status = PayrollRun.Status.FUNDING_READY
        self.payroll.onchain_status = 4
        self.payroll.save(update_fields=["status", "onchain_status"])
        prepared = prepare_funding(actor=self.account, payroll=self.payroll)
        selector = Web3.keccak(text="fundPayroll(uint256,uint256)")[:4].hex()
        self.assertTrue(prepared.calldata.startswith(selector))
        self.assertEqual(prepared.metadata["amount"], "2000000")
        self.assertEqual(prepared.contract_address, "0xA5277D55a46514740b0C716C691d92b8D9E64e5E")

    @patch("apps.payroll.services.get_funding_context")
    def test_funding_rejects_low_allowance(self, mocked_context):
        context = self.funding_context()
        context["vault_allowance"] = "1999999"
        mocked_context.return_value = context
        self.payroll.status = PayrollRun.Status.FUNDING_READY
        self.payroll.onchain_status = 4
        self.payroll.save(update_fields=["status", "onchain_status"])
        with self.assertRaisesMessage(PayrollFlowError, "allowance"):
            prepare_funding(actor=self.account, payroll=self.payroll)

    def test_confirm_open_funding_records_pending_state(self):
        prepared = prepare_open_funding(actor=self.account, payroll=self.payroll)
        chain_tx = confirm_open_funding(
            actor=self.account,
            payroll=self.payroll,
            prepared_transaction_id=prepared.id,
            tx_hash="0x" + "77" * 32,
        )
        self.payroll.refresh_from_db()
        self.assertEqual(chain_tx.status, "pending")
        self.assertEqual(self.payroll.status, PayrollRun.Status.OPEN_FUNDING_TX_PENDING)
