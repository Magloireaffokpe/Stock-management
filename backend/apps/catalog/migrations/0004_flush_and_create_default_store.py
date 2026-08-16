# Generated custom data migration

from django.db import migrations

def safe_execute(cursor, sql):
    try:
        cursor.execute(sql)
    except Exception:
        pass

def flush_and_create_default_store(apps, schema_editor):
    Store = apps.get_model('stores', 'Store')
    # Create default store if not exists
    default_store, created = Store.objects.get_or_create(
        slug='boutique-1',
        defaults={'name': 'Boutique 1', 'is_active': True, 'order': 1}
    )
    
    # Run the flush using connection cursor
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("PRAGMA foreign_keys = OFF;")
        safe_execute(cursor, "DELETE FROM catalog_product;")
        safe_execute(cursor, "DELETE FROM catalog_category;")
        safe_execute(cursor, "DELETE FROM catalog_subcategory;")
        safe_execute(cursor, "DELETE FROM sales_quotationitem;")
        safe_execute(cursor, "DELETE FROM sales_quotation;")
        safe_execute(cursor, "DELETE FROM sales_restockitem;")
        safe_execute(cursor, "DELETE FROM sales_restock;")
        safe_execute(cursor, "DELETE FROM stock_stockmovement;")
        safe_execute(cursor, "DELETE FROM stock_stockalert;")
        safe_execute(cursor, "UPDATE sales_saleitem SET product_id = NULL;")
        cursor.execute("PRAGMA foreign_keys = ON;")

class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0003_category_parent_category_store_product_store_and_more"),
        ("sales", "0004_remove_restock_total_cost_and_more"),
    ]

    operations = [
        migrations.RunPython(flush_and_create_default_store),
    ]
