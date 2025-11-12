from django.urls import path
from . import views 

urlpatterns = [
    path('', views.index, name='index'), 

    # Autenticación
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('login/', views.login_view, name='login'),

    # Contenido
    path('dashboard/', views.dashboard, name='dashboard'),
    path('favorites/', views.favorites_view, name='favorites'),
    path('favorites/add/', views.add_favorite, name='add_favorite'),
    path('settings/', views.settings_view, name='settings'),
    path('detail/<str:item_type>/<str:item_id>/', views.detail_view, name='detail'),
    path('favorites/remove/', views.remove_favorite, name='remove_favorite'),
    path('favorites/clear/', views.clear_favorites, name='clear_favorites'),
]