from django.urls import path
from . import views

urlpatterns = [
    path("plan-trip/",     views.plan_trip,          name="plan_trip"),
    path("calculate-hos/", views.calculate_hos_only,  name="calculate_hos"),
    path("health/",        views.health_check,        name="health_check"),
]
