from django.contrib import admin

from .models import Institution, InstitutionMember

admin.site.register(Institution)
admin.site.register(InstitutionMember)
