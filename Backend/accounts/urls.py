from django.urls import path

from . import views


urlpatterns = [
    path("auth/signup/", views.signup_view, name="signup"),
    path("auth/login/", views.login_view, name="login"),
    path("auth/me/", views.me_view, name="me"),
    path("github/oauth/start/", views.github_oauth_start_view, name="github-oauth-start"),
    path("github/disconnect/", views.github_disconnect_view, name="github-disconnect"),
    path(
        "github/oauth/complete/",
        views.github_oauth_complete_view,
        name="github-oauth-complete",
    ),
    path("github/repos/", views.github_repos_view, name="github-repos"),
]

