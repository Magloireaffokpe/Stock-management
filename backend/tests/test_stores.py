"""
Tests des endpoints Boutiques (création, slug auto, compteurs, suppression bloquée).
"""
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .base import BaseTestCase
from .factories import make_admin, make_settings, make_store, make_category, make_product


class StoreAPITest(BaseTestCase):
    def setUp(self):
        super().setUp()

    def test_liste_boutiques_accessible(self):
        make_store(name="Boutique Liste Test")
        r = self.employee_client.get("/api/stores/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        names = [s["name"] for s in r.data["results"]]
        self.assertIn("Boutique Liste Test", names)

    def test_employé_lecture_seule_peut_voir_les_boutiques(self):
        """L'employé voit les boutiques mais ne peut ni créer ni modifier"""
        make_store(name="Boutique Visible Employé")

        # Lecture OK
        r_get = self.employee_client.get("/api/stores/")
        self.assertEqual(r_get.status_code, status.HTTP_200_OK)

        # Création interdite
        r_create = self.employee_client.post(
            "/api/stores/", {"name": "Boutique Interdite"}, format="json"
        )
        self.assertEqual(r_create.status_code, status.HTTP_403_FORBIDDEN)

        # Modification interdite
        s = make_store(name="Boutique à Ne Pas Modifier")
        r_patch = self.employee_client.patch(
            f"/api/stores/{s.pk}/", {"name": "Hackée"}, format="json"
        )
        self.assertEqual(r_patch.status_code, status.HTTP_403_FORBIDDEN)

    def test_employé_ne_peut_pas_supprimer_boutique(self):
        store = make_store(name="Boutique Non Supprimable Par Employé")
        r = self.employee_client.delete(f"/api/stores/{store.pk}/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_créer_boutique_génère_slug(self):
        r = self.admin_client.post(
            "/api/stores/",
            {"name": "Boutique Slug Auto"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["slug"], "boutique-slug-auto")
        self.assertTrue(r.data["is_active"])

    def test_créer_boutique_slug_unique(self):
        self.admin_client.post("/api/stores/", {"name": "Boutique Double"}, format="json")
        r = self.admin_client.post("/api/stores/", {"name": "Boutique Double"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", r.data)

    def test_liste_contient_compteurs(self):
        store = make_store(name="Boutique Compteurs")
        make_category(name="Cat Compteur", store=store)
        cat2 = make_category(name="Cat Compteur 2", store=store)
        make_product(name="Prod Compteur", category=cat2, store=store)
        r = self.employee_client.get("/api/stores/")
        store_data = next(s for s in r.data["results"] if s["id"] == store.pk)
        self.assertEqual(store_data["category_count"], 2)
        self.assertEqual(store_data["product_count"], 1)

    def test_suppression_boutique_bloquée(self):
        store = make_store(name="Boutique Non Supprimable")
        r = self.admin_client.delete(f"/api/stores/{store.pk}/")
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
