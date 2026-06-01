"""
Tests — app auth_app
Couvre : Login/Logout JWT, profil, gestion utilisateurs, journal d'activité
"""
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.auth_app.models import ActivityLog
from .base import BaseTestCase
from .factories import make_admin, make_employee


class LoginTest(BaseTestCase):
    """Unitaire + Intégration — Authentification JWT"""

    def test_login_valide_retourne_tokens_et_user(self):
        r = self.client.post('/api/auth/login/', {
            'username': 'admin_test',
            'password': 'testpass123',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('access', r.data)
        self.assertIn('refresh', r.data)
        self.assertIn('user', r.data)
        user_data = r.data['user']
        self.assertEqual(user_data['username'], 'admin_test')
        self.assertEqual(user_data['role'], 'admin')

    def test_login_mauvais_mot_de_passe_retourne_401(self):
        r = self.client.post('/api/auth/login/', {
            'username': 'admin_test',
            'password': 'mauvais_mdp',
        })
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('access', r.data)

    def test_login_utilisateur_inexistant_retourne_401(self):
        r = self.client.post('/api/auth/login/', {
            'username': 'fantôme',
            'password': 'testpass123',
        })
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_crée_entrée_journal_activité(self):
        count_before = ActivityLog.objects.filter(action='login').count()
        self.client.post('/api/auth/login/', {
            'username': 'admin_test',
            'password': 'testpass123',
        })
        count_after = ActivityLog.objects.filter(action='login').count()
        self.assertEqual(count_after, count_before + 1)

    def test_token_access_contient_rôle_et_nom(self):
        """Le payload JWT doit embarquer username, role, full_name"""
        import base64, json
        r = self.client.post('/api/auth/login/', {
            'username': 'admin_test',
            'password': 'testpass123',
        })
        token = r.data['access']
        payload_b64 = token.split('.')[1]
        # Padding base64
        payload_b64 += '=' * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.b64decode(payload_b64))
        self.assertEqual(payload['username'], 'admin_test')
        self.assertEqual(payload['role'], 'admin')
        self.assertIn('full_name', payload)

    def test_refresh_token_fonctionne(self):
        r_login = self.client.post('/api/auth/login/', {
            'username': 'admin_test', 'password': 'testpass123',
        })
        r_refresh = self.client.post('/api/token/refresh/', {
            'refresh': r_login.data['refresh'],
        })
        self.assertEqual(r_refresh.status_code, status.HTTP_200_OK)
        self.assertIn('access', r_refresh.data)

    def test_utilisateur_inactif_ne_peut_pas_se_connecter(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        User.objects.filter(username='employee_test').update(is_active=False)
        r = self.client.post('/api/auth/login/', {
            'username': 'employee_test', 'password': 'testpass123',
        })
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        # Remettre actif pour ne pas casser d'autres tests
        User.objects.filter(username='employee_test').update(is_active=True)


class LogoutTest(BaseTestCase):
    """Intégration — Déconnexion et blacklist token"""

    def test_logout_avec_token_valide(self):
        refresh = RefreshToken.for_user(self.admin)
        r = self.admin_client.post('/api/auth/logout/', {
            'refresh': str(refresh),
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_logout_sans_auth_retourne_401(self):
        r = self.client.post('/api/auth/logout/', {'refresh': 'bidon'})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_blacklisté_après_logout(self):
        """Un refresh token blacklisté ne peut plus être utilisé"""
        refresh = RefreshToken.for_user(self.admin)
        access = str(refresh.access_token)
        refresh_str = str(refresh)

        client_temp = self._build_client(self.admin)
        client_temp.post('/api/auth/logout/', {'refresh': refresh_str})

        # Tenter de rafraîchir avec le token blacklisté
        r = self.client.post('/api/token/refresh/', {'refresh': refresh_str})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)


class ProfileTest(BaseTestCase):
    """Intégration — GET/PATCH /api/auth/me/"""

    def test_get_me_retourne_infos_utilisateur(self):
        r = self.admin_client.get('/api/auth/me/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['username'], 'admin_test')
        self.assertEqual(r.data['role'], 'admin')
        self.assertIn('email', r.data)

    def test_get_me_sans_auth_retourne_401(self):
        r = self.client.get('/api/auth/me/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patch_me_change_prénom(self):
        r = self.admin_client.patch('/api/auth/me/', {
            'first_name': 'Nouveau Prénom',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['first_name'], 'Nouveau Prénom')
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.first_name, 'Nouveau Prénom')

    def test_patch_me_changer_mot_de_passe(self):
        r = self.admin_client.patch('/api/auth/me/', {
            'password': 'nouveauMdp456',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password('nouveauMdp456'))
        # Remettre le mot de passe d'origine
        self.admin.set_password('testpass123')
        self.admin.save()

    def test_patch_me_employé_ne_peut_pas_changer_rôle(self):
        """Le champ rôle ne doit pas être dans les champs allowed de /me/"""
        r = self.employee_client.patch('/api/auth/me/', {
            'role': 'admin',
        }, format='json')
        # La vue ignore les champs non autorisés — rôle inchangé
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.role, 'employee')


class UserManagementTest(BaseTestCase):
    """Intégration — CRUD utilisateurs (admin seulement)"""

    def test_liste_utilisateurs_admin_seulement(self):
        r_emp = self.employee_client.get('/api/auth/users/')
        self.assertEqual(r_emp.status_code, status.HTTP_403_FORBIDDEN)

        r_adm = self.admin_client.get('/api/auth/users/')
        self.assertEqual(r_adm.status_code, status.HTTP_200_OK)

    def test_créer_utilisateur_retourne_201(self):
        r = self.admin_client.post('/api/auth/users/', {
            'username': 'nouveau_user',
            'password': 'pass12345',
            'first_name': 'Jean',
            'last_name': 'Koffi',
            'email': 'jean@test.bj',
            'role': 'employee',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['username'], 'nouveau_user')
        self.assertEqual(r.data['role'], 'employee')

    def test_créer_utilisateur_mot_de_passe_hashé(self):
        """Le mot de passe ne doit jamais être stocké en clair"""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.admin_client.post('/api/auth/users/', {
            'username': 'hash_test',
            'password': 'clair12345',
            'role': 'employee',
        }, format='json')
        user = User.objects.get(username='hash_test')
        self.assertNotEqual(user.password, 'clair12345')
        self.assertTrue(user.check_password('clair12345'))

    def test_modifier_utilisateur(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        target = make_employee(username='target_user')
        r = self.admin_client.patch(f'/api/auth/users/{target.id}/', {
            'is_active': False,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        target.refresh_from_db()
        self.assertFalse(target.is_active)

    def test_supprimer_son_propre_compte_interdit(self):
        r = self.admin_client.delete(f'/api/auth/users/{self.admin.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_supprimer_autre_utilisateur_ok(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        target = make_employee(username='à_supprimer')
        r = self.admin_client.delete(f'/api/auth/users/{target.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(username='à_supprimer').exists())


class ActivityLogTest(BaseTestCase):
    """Intégration — Journal d'activité"""

    def test_journal_accessible_admin_seulement(self):
        r_emp = self.employee_client.get('/api/auth/activity/')
        self.assertEqual(r_emp.status_code, status.HTTP_403_FORBIDDEN)

        r_adm = self.admin_client.get('/api/auth/activity/')
        self.assertEqual(r_adm.status_code, status.HTTP_200_OK)

    def test_journal_contient_les_bons_champs(self):
        ActivityLog.objects.create(
            user=self.admin,
            action='login',
            description='Test log',
        )
        r = self.admin_client.get('/api/auth/activity/')
        results = r.data.get('results', r.data)
        if results:
            entry = results[0]
            self.assertIn('action', entry)
            self.assertIn('description', entry)
            self.assertIn('created_at', entry)
            self.assertIn('user_display', entry)
