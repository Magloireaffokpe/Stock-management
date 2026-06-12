from datetime import timedelta
from django.utils import timezone
from .models import AuditLog

def get_client_ip(request):
    """Récupère l'adresse IP du client depuis la requête"""
    if not request:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def log_audit_action(request, action_type, description, old_value=None, new_value=None):
    """
    Enregistre une action dans le journal d'audit.
    Nettoie également les logs de plus de 30 jours pour ne pas surcharger la base de données.
    """
    ip = get_client_ip(request)
    user = request.user if request and hasattr(request, 'user') and request.user.is_authenticated else None
    
    AuditLog.objects.create(
        user=user,
        action_type=action_type,
        description=description,
        ip_address=ip,
        old_value=old_value,
        new_value=new_value
    )
    
    # Nettoyage : On supprime les logs plus vieux que 30 jours
    # (Un delete sur un champ indexé ou par lot est généralement rapide)
    thirty_days_ago = timezone.now() - timedelta(days=30)
    AuditLog.objects.filter(created_at__lt=thirty_days_ago).delete()
