from django.contrib.auth import get_user_model
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import ActivityLog
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserSerializer,
    ActivityLogSerializer,
)

User = get_user_model()


def get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return x_forwarded.split(',')[0] if x_forwarded else request.META.get('REMOTE_ADDR')


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user = User.objects.get(username=request.data.get('username'))
            ActivityLog.objects.create(
                user=user,
                action='login',
                description=f'Connexion depuis {get_client_ip(request)}',
                ip_address=get_client_ip(request),
            )
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            ActivityLog.objects.create(
                user=request.user,
                action='logout',
                description='Déconnexion',
                ip_address=get_client_ip(request),
            )
        except Exception:
            pass
        return Response({'message': 'Déconnecté avec succès'})


class MeView(APIView):
    """Infos de l'utilisateur connecté"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        """Permet de changer son propre mot de passe / infos de base"""
        allowed = ['first_name', 'last_name', 'email', 'phone', 'password']
        data = {k: v for k, v in request.data.items() if k in allowed}
        serializer = UserSerializer(request.user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class UserListCreateView(generics.ListCreateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        return User.objects.all().order_by('-date_joined')

    def perform_create(self, serializer):
        user = serializer.save()
        ActivityLog.objects.create(
            user=self.request.user,
            action='user_created',
            description=f'Utilisateur créé : {user.username}',
            ip_address=get_client_ip(self.request),
        )


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]
    queryset = User.objects.all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance == request.user:
            return Response(
                {'error': 'Vous ne pouvez pas supprimer votre propre compte'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class ActivityLogView(generics.ListAPIView):
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ['user', 'action']
    search_fields = ['description', 'user__username']
    ordering_fields = ['created_at']

    def get_queryset(self):
        return ActivityLog.objects.select_related('user').all()[:500]
