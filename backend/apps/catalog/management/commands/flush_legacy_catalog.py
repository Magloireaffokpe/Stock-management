import os
from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = "Vide les tables de produits et catégories existantes pour préparer le multi-boutique"

    def handle(self, *args, **options):
        self.stdout.write("Vidage du catalogue hérité (legacy)...")
        
        with connection.cursor() as cursor:
            # Désactiver les contraintes de clés étrangères temporairement pour SQLite
            cursor.execute("PRAGMA foreign_keys = OFF;")
            
            # Vider les tables liées au catalogue
            cursor.execute("DELETE FROM catalog_product;")
            cursor.execute("DELETE FROM catalog_category;")
            cursor.execute("DELETE FROM catalog_subcategory;")
            
            # Vider également les réapprovisionnements, devis et mouvements de stock qui pointent vers les produits supprimés
            cursor.execute("DELETE FROM sales_quotationitem;")
            cursor.execute("DELETE FROM sales_quotation;")
            cursor.execute("DELETE FROM sales_restockitem;")
            cursor.execute("DELETE FROM sales_restock;")
            cursor.execute("DELETE FROM stock_stockmovement;")
            cursor.execute("DELETE FROM stock_stockalert;")
            
            # Pour les ventes, on met simplement à jour le product_id à NULL (SET_NULL)
            cursor.execute("UPDATE sales_saleitem SET product_id = NULL;")
            
            # Réactiver les contraintes
            cursor.execute("PRAGMA foreign_keys = ON;")
            
        self.stdout.write(self.style.SUCCESS("Catalogue hérité vidé avec succès."))
