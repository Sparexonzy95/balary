from django.urls import path

from .views import Coston2ConfigView

urlpatterns = [path("coston2/", Coston2ConfigView.as_view(), name="coston2-config")]
