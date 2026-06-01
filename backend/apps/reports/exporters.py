"""
Exporteurs de données vers Excel (openpyxl).
Appelés depuis reports/views.py pour les exports.
"""
import io
from datetime import date

from django.http import HttpResponse

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False


HEADER_FILL  = PatternFill('solid', fgColor='1A2B4A') if OPENPYXL_AVAILABLE else None
HEADER_FONT  = Font(color='FFFFFF', bold=True) if OPENPYXL_AVAILABLE else None
ACCENT_FILL  = PatternFill('solid', fgColor='EFF6FF') if OPENPYXL_AVAILABLE else None


def _auto_width(ws):
    """Ajuste automatiquement la largeur des colonnes"""
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            try:
                max_len = max(max_len, len(str(cell.value or '')))
            except Exception:
                pass
        ws.column_dimensions[col_letter].width = min(max_len + 4, 50)


def export_sales_excel(queryset):
    """Export de l'historique des ventes"""
    if not OPENPYXL_AVAILABLE:
        return None

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Historique ventes'

    headers = ['N° Facture', 'Date', 'Client', 'Sous-total', 'Remise',
               'TVA', 'Total', 'Paiement', 'Statut', 'Caissier']
    ws.append(headers)

    for cell in ws[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal='center')

    for sale in queryset:
        ws.append([
            sale.invoice_number,
            sale.sale_date.strftime('%d/%m/%Y %H:%M'),
            sale.client.full_name if sale.client else 'Client comptoir',
            float(sale.subtotal),
            float(sale.discount),
            float(sale.tax_amount),
            float(sale.total_amount),
            sale.get_payment_method_display(),
            'Annulée' if sale.is_cancelled else 'Validée',
            sale.created_by.get_full_name() if sale.created_by else '',
        ])

    _auto_width(ws)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f'ventes_{date.today().isoformat()}.xlsx'
    response = HttpResponse(
        buffer.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def export_products_excel(queryset):
    """Export du catalogue produits"""
    if not OPENPYXL_AVAILABLE:
        return None

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Catalogue produits'

    headers = ['SKU', 'Nom', 'Catégorie', 'Fournisseur', 'État',
               'Prix achat', 'Prix vente', 'Marge', 'Marge %',
               'Stock', 'Statut stock', 'Actif']
    ws.append(headers)

    for cell in ws[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal='center')

    for product in queryset:
        ws.append([
            product.sku,
            product.name,
            product.category.name,
            product.supplier.name if product.supplier else '',
            product.get_condition_display(),
            float(product.purchase_price),
            float(product.selling_price),
            float(product.margin),
            float(product.margin_percent),
            product.stock_quantity,
            product.stock_status,
            'Oui' if product.is_active else 'Non',
        ])

    _auto_width(ws)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f'produits_{date.today().isoformat()}.xlsx'
    response = HttpResponse(
        buffer.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def export_stock_movements_excel(queryset):
    """Export des mouvements de stock"""
    if not OPENPYXL_AVAILABLE:
        return None

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Mouvements stock'

    headers = ['Date', 'Produit', 'SKU', 'Type mouvement', 'Qté',
               'Stock avant', 'Stock après', 'Référence', 'Note', 'Utilisateur']
    ws.append(headers)

    for cell in ws[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT

    for m in queryset:
        ws.append([
            m.created_at.strftime('%d/%m/%Y %H:%M'),
            m.product.name,
            m.product.sku,
            m.get_movement_type_display(),
            m.quantity,
            m.stock_before,
            m.stock_after,
            m.reference,
            m.note,
            m.created_by.get_full_name() if m.created_by else 'Système',
        ])

    _auto_width(ws)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f'mouvements_stock_{date.today().isoformat()}.xlsx'
    response = HttpResponse(
        buffer.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
