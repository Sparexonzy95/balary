from django.contrib import admin

from .models import ChainTransaction, PreparedTransaction

admin.site.register(PreparedTransaction)
admin.site.register(ChainTransaction)
