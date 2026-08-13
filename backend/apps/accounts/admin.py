from django.contrib import admin

from .models import Account, WalletNonce

admin.site.register(Account)
admin.site.register(WalletNonce)
