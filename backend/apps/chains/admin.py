from django.contrib import admin

from .models import Chain, ContractDeployment, SupportedToken

admin.site.register(Chain)
admin.site.register(ContractDeployment)
admin.site.register(SupportedToken)
