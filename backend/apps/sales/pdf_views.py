"""
Génération PDF des factures via WeasyPrint.
Accessible via GET /api/sales/sales/<id>/pdf/
"""
import os
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.template.loader import render_to_string
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from .access import visible_sales_queryset


class InvoicePDFView(APIView):
    """Génère ou récupère la facture PDF d'une vente"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from apps.sales.models import Sale
        from apps.settings_app.models import StoreSettings

        try:
            sale = visible_sales_queryset(
                request.user,
                Sale.objects.prefetch_related('items__product').select_related(
                    'client', 'created_by'
                ),
            ).get(pk=pk)
        except Sale.DoesNotExist:
            return Response({'error': 'Vente introuvable'}, status=404)

        store = StoreSettings.get()

        # URL du logo pour le template
        logo_url = None
        if store.logo:
            logo_url = request.build_absolute_uri(store.logo.url)

        context = {
            'invoice': sale,
            'store':   store,
            'logo_url': logo_url,
        }

        try:
            from weasyprint import HTML, CSS
            html_string = render_to_string('invoices/facture.html', context)
            pdf_bytes   = HTML(string=html_string, base_url=request.build_absolute_uri('/')).write_pdf()

            # Sauvegarder le PDF
            factures_dir = settings.FACTURES_DIR
            os.makedirs(factures_dir, exist_ok=True)
            pdf_path = factures_dir / f'{sale.invoice_number}.pdf'
            with open(pdf_path, 'wb') as f:
                f.write(pdf_bytes)

            # Enregistrer la référence dans la vente
            relative_path = f'factures/{sale.invoice_number}.pdf'
            Sale.objects.filter(pk=pk).update(pdf_file=relative_path)

            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="{sale.invoice_number}.pdf"'
            return response

        except ImportError:
            # WeasyPrint non installé — retourner le HTML à la place
            html_string = render_to_string('invoices/facture.html', context)
            return HttpResponse(html_string, content_type='text/html')
        except Exception as e:
            return Response({'error': f'Erreur PDF : {str(e)}'}, status=500)
