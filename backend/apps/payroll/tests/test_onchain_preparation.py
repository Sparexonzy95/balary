from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from eth_account import Account as EthAccount
from web3 import Web3

from apps.accounts.models import Account
from apps.chains.services import ensure_coston2_config
from apps.institutions.models import Institution, InstitutionMember
from apps.fcc.tee_authorization import AuthorizedTee
from apps.payroll.models import PayrollRun
from apps.payroll.services import (
    PayrollFlowError,
    confirm_computation_request,
    confirm_payroll_draft,
    prepare_computation_request,
    prepare_payroll_draft,
)


@override_settings(ZALARY_FCC_FEE_WEI=1_000_000)
class PayrollOnchainPreparationTests(TestCase):
    def setUp(self):
        self.wallet = EthAccount.create().address
        self.account = Account.objects.create_user(self.wallet)
        chain, vault, _, _ = ensure_coston2_config()
        self.institution = Institution.objects.create(
            name="Onchain Co",
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
        InstitutionMember.objects.create(
            institution=self.institution,
            account=self.account,
            wallet_address=self.wallet,
            role=InstitutionMember.Role.HR,
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
            metadata_hash="0x" + "12" * 32,
            ciphertext="0x" + "ab" * 100,
            ciphertext_hash="0x" + "34" * 32,
            selected_tee_id="0x7748CB088399CB4223375298F7404394A1680D2D",
            encrypted_at=timezone.now(),
            status=PayrollRun.Status.ENCRYPTED_READY,
            created_by=self.account,
        )
        tee_patcher = patch(
            "apps.fcc.tee_authorization.resolve_live_authorized_tee",
            return_value=AuthorizedTee(
                tee_id=self.payroll.selected_tee_id,
                signer=self.payroll.selected_tee_id,
                epoch=1,
            ),
        )
        tee_patcher.start()
        self.addCleanup(tee_patcher.stop)

    def test_prepare_draft_targets_vault_with_correct_selector(self):
        prepared = prepare_payroll_draft(actor=self.account, payroll=self.payroll)
        selector = Web3.keccak(text="createPayrollDraft(uint256,address,bytes32,uint64,uint64,uint64,uint64)")[:4].hex()
        self.assertTrue(prepared.calldata.startswith(selector))
        self.assertEqual(prepared.contract_address, "0xA5277D55a46514740b0C716C691d92b8D9E64e5E")
        self.assertEqual(prepared.value_wei, "0")

    def test_confirm_draft_records_pending_state(self):
        prepared = prepare_payroll_draft(actor=self.account, payroll=self.payroll)
        chain_tx = confirm_payroll_draft(
            actor=self.account,
            payroll=self.payroll,
            prepared_transaction_id=prepared.id,
            tx_hash="0x" + "55" * 32,
        )
        self.payroll.refresh_from_db()
        self.assertEqual(chain_tx.status, "pending")
        self.assertEqual(self.payroll.status, PayrollRun.Status.DRAFT_TX_PENDING)

    def test_prepare_computation_targets_gateway_and_includes_fcc_fee(self):
        self.payroll.status = PayrollRun.Status.DRAFT_ONCHAIN
        self.payroll.save(update_fields=["status"])
        prepared = prepare_computation_request(actor=self.account, payroll=self.payroll)
        selector = Web3.keccak(text="requestPayrollComputation(uint256,bytes)")[:4].hex()
        self.assertTrue(prepared.calldata.startswith(selector))
        self.assertEqual(prepared.contract_address, "0xFE9A84346A614599C9A0b5a1F444bd816a6C100A")
        self.assertEqual(prepared.value_wei, "1000000")

    def test_wrong_encryption_tee_is_rejected(self):
        self.payroll.status = PayrollRun.Status.DRAFT_ONCHAIN
        self.payroll.selected_tee_id = EthAccount.create().address
        self.payroll.save(update_fields=["status", "selected_tee_id"])
        with self.assertRaisesMessage(PayrollFlowError, "encryption TEE"):
            prepare_computation_request(actor=self.account, payroll=self.payroll)

    def test_confirm_computation_records_pending_state(self):
        self.payroll.status = PayrollRun.Status.DRAFT_ONCHAIN
        self.payroll.save(update_fields=["status"])
        prepared = prepare_computation_request(actor=self.account, payroll=self.payroll)
        chain_tx = confirm_computation_request(
            actor=self.account,
            payroll=self.payroll,
            prepared_transaction_id=prepared.id,
            tx_hash="0x" + "66" * 32,
        )
        self.payroll.refresh_from_db()
        self.assertEqual(chain_tx.status, "pending")
        self.assertEqual(self.payroll.status, PayrollRun.Status.COMPUTATION_TX_PENDING)
