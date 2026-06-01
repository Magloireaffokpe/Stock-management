from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Utilisateur étendu avec rôle"""
    ROLES = [
        ('admin',    'Administrateur'),
        ('employee', 'Employé'),
    ]
    role = models.CharField(max_length=15, choices=ROLES, default='employee')
    phone = models.CharField(max_length=20, blank=True)

    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'

    @property
    def is_admin_role(self):
        return self.role == 'admin' or self.is_superuser


class ActivityLog(models.Model):
    """Journal d'activité — trace toutes les actions importantes"""
    ACTION_CHOICES = [
        ('login',           'Connexion'),
        ('logout',          'Déconnexion'),
        ('sale_created',    'Vente créée'),
        ('sale_cancelled',  'Vente annulée'),
        ('product_created', 'Produit créé'),
        ('product_updated', 'Produit modifié'),
        ('product_deleted', 'Produit supprimé'),
        ('restock',         'Réapprovisionnement'),
        ('adjustment',      'Ajustement stock'),
        ('settings_updated','Paramètres modifiés'),
        ('backup',          'Sauvegarde'),
        ('user_created',    'Utilisateur créé'),
        ('other',           'Autre'),
    ]
    user        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='activity_logs')
    action      = models.CharField(max_length=30, choices=ACTION_CHOICES)
    description = models.CharField(max_length=500, blank=True)
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Journal activité'

    def __str__(self):
        return f'{self.user} — {self.action} — {self.created_at}'
