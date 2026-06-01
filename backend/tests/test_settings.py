"""
Tests unitaires — app settings_app
Couvre : Singleton, GET/PATCH API, Sauvegarde/Restauration
"""
import io
import os
import shutil
import tempfile
from pathlib import Path

from django.test import override_settings
from rest_framework import status

from apps.settings_app.models import StoreSettings
from .base import BaseTestCase


class StoreSettingsSingletonTest(BaseTestCase):
    """Unitaire — modèle StoreSettings (singleton)"""

    def test_get_crée_instance_si_absente(self):
        """StoreSettings.get() crée l'objet si la table est vide"""
        StoreSettings.objects.all().delete()
        s = StoreSettings.get()
        self.assertIsNotNone(s)
        self.assertEqual(StoreSettings.objects.count(), 1)

    def test_get_retourne_toujours_id_1(self):
        """Toute sauvegarde force pk=1"""
        s = StoreSettings.get()
        self.assertEqual(s.pk, 1)
        # Un deuxième appel retourne le même objet
        s2 = StoreSettings.get()
        self.assertEqual(s.pk, s2.pk)

    def test_save_force_pk_1(self):
        """save() écrase toujours pk=1 — impossible d'avoir deux instances"""
        StoreSettings.objects.all().delete()
        s = StoreSettings(store_name='Test', low_stock_threshold=3)
        s.save()
        self.assertEqual(s.pk, 1)
        self.assertEqual(StoreSettings.objects.count(), 1)

    def test_valeurs_par_défaut(self):
        StoreSettings.objects.all().delete()
        s = StoreSettings.get()
        self.assertEqual(s.currency, 'FCFA')
        self.assertEqual(s.low_stock_threshold, 5)
        self.assertEqual(s.critical_stock_threshold, 2)
        self.assertEqual(s.invoice_prefix, 'MICRO')
        self.assertTrue(s.sound_enabled)


class StoreSettingsAPIGetTest(BaseTestCase):
    """Intégration — GET /api/settings/"""

    def test_get_accessible_par_employé(self):
        r = self.employee_client.get('/api/settings/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('store_name', r.data)
        self.assertIn('currency', r.data)
        self.assertIn('low_stock_threshold', r.data)

    def test_get_accessible_par_admin(self):
        r = self.admin_client.get('/api/settings/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_get_refusé_sans_auth(self):
        r = self.client.get('/api/settings/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_retourne_toutes_les_clés_attendues(self):
        r = self.admin_client.get('/api/settings/')
        clés = [
            'store_name', 'tagline', 'phone', 'whatsapp', 'email',
            'address', 'city', 'currency', 'currency_symbol',
            'color_primary', 'color_accent', 'color_success',
            'low_stock_threshold', 'critical_stock_threshold', 'sound_enabled',
            'invoice_prefix', 'invoice_counter', 'tax_rate', 'footer_invoice_text',
        ]
        for clé in clés:
            self.assertIn(clé, r.data, f'Clé manquante dans la réponse : {clé}')


class StoreSettingsAPIPatchTest(BaseTestCase):
    """Intégration — PATCH /api/settings/"""

    def test_patch_réservé_admin(self):
        r = self.employee_client.patch('/api/settings/', {'store_name': 'Hacké'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_nom_magasin(self):
        r = self.admin_client.patch('/api/settings/', {'store_name': 'NOUVEAU NOM'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['store_name'], 'NOUVEAU NOM')
        # Vérification en BDD
        self.assertEqual(StoreSettings.get().store_name, 'NOUVEAU NOM')

    def test_patch_seuils_alertes(self):
        r = self.admin_client.patch('/api/settings/', {
            'low_stock_threshold': 10,
            'critical_stock_threshold': 3,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        s = StoreSettings.get()
        self.assertEqual(s.low_stock_threshold, 10)
        self.assertEqual(s.critical_stock_threshold, 3)

    def test_patch_partiel_ne_réinitialise_pas_autres_champs(self):
        original_name = StoreSettings.get().store_name
        self.admin_client.patch('/api/settings/', {'currency': 'USD'}, format='json')
        s = StoreSettings.get()
        self.assertEqual(s.store_name, original_name)  # Inchangé
        self.assertEqual(s.currency, 'USD')

    def test_patch_couleurs_valides(self):
        r = self.admin_client.patch('/api/settings/', {
            'color_primary': '#FF0000',
            'color_accent': '#00FF00',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_tax_rate(self):
        r = self.admin_client.patch('/api/settings/', {'tax_rate': '18.00'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(str(r.data['tax_rate']), '18.00')


class BackupAPITest(BaseTestCase):
    """Intégration — Sauvegarde et restauration BDD"""

    def test_liste_backups_accessible_admin_seulement(self):
        r_emp = self.employee_client.get('/api/settings/backup/list/')
        self.assertEqual(r_emp.status_code, status.HTTP_403_FORBIDDEN)

        r_adm = self.admin_client.get('/api/settings/backup/list/')
        self.assertEqual(r_adm.status_code, status.HTTP_200_OK)
        self.assertIsInstance(r_adm.data, list)

    def test_sauvegarde_manuelle_crée_fichier(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with override_settings(BACKUP_DIR=Path(tmpdir)):
                r = self.admin_client.post('/api/settings/backup/manual/')
                self.assertEqual(r.status_code, status.HTTP_200_OK)
                self.assertIn('Sauvegarde créée', r.data.get('message', ''))
                # Vérifier que le fichier existe
                backups = list(Path(tmpdir).glob('*.sqlite3'))
                self.assertEqual(len(backups), 1)
                self.assertTrue(backups[0].name.startswith('manual_'))

    def test_export_db_retourne_binaire_sqlite(self):
        r = self.admin_client.get('/api/settings/backup/export/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.get('Content-Type'), 'application/octet-stream')
        self.assertIn('micrologis_backup_', r.get('Content-Disposition', ''))

    def test_export_db_refusé_employé(self):
        r = self.employee_client.get('/api/settings/backup/export/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
