"""
Génération PDF des factures via WeasyPrint.
Endpoint séparé pour ne pas bloquer la création de vente.
"""
import os
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.template.loader import render_to_string
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.sales.models import Sale
from apps.settings_app.models import StoreSettings


def generate_pdf(sale):
    """Génère le PDF WeasyPrint et le sauvegarde dans /factures/"""
    try:
        from weasyprint import HTML, CSS
    except ImportError:
        return None, 'WeasyPrint non installé'

    store   = StoreSettings.get()
    logo_url = None
    if store.logo:
        logo_url = f'file://{settings.MEDIA_ROOT}/{store.logo.name}'

    html_string = render_to_string('invoices/facture.html', {
        'invoice':  sale,
        'store':    store,
        'logo_url': logo_url,
    })

    factures_dir = Path(settings.FACTURES_DIR)
    factures_dir.mkdir(exist_ok=True)
    pdf_path = factures_dir / f'{sale.invoice_number}.pdf'

    HTML(string=html_string, base_url=str(settings.BASE_DIR)).write_pdf(str(pdf_path))
    return pdf_path, None


class InvoicePDFView(APIView):
    """
    GET /api/sales/<pk>/invoice/pdf/
    Génère (si nécessaire) et retourne le PDF de la facture.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            sale = Sale.objects.prefetch_related('items__product').select_related(
                'client', 'created_by'
            ).get(pk=pk)
        except Sale.DoesNotExist:
            return Response({'error': 'Vente introuvable'}, status=404)

        # Chercher le PDF déjà généré
        pdf_path = Path(settings.FACTURES_DIR) / f'{sale.invoice_number}.pdf'

        if not sale.pdf_file or not pdf_path.exists():
            pdf_path, error = generate_pdf(sale)
            if error:
                return Response({'error': error}, status=500)
            if pdf_path and pdf_path.exists():
                # Sauvegarder le chemin dans la BDD
                relative = f'factures/{sale.invoice_number}.pdf'
                Sale.objects.filter(pk=sale.pk).update(pdf_file=relative)

        if pdf_path and pdf_path.exists():
            return FileResponse(
                open(pdf_path, 'rb'),
                content_type='application/pdf',
                as_attachment=False,
                filename=f'{sale.invoice_number}.pdf',
            )

        return Response({'error': 'Impossible de générer le PDF'}, status=500)


class InvoicePDFRegenerateView(APIView):
    """Force la régénération du PDF (après modif paramètres/logo)"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            sale = Sale.objects.prefetch_related('items__product').select_related(
                'client', 'created_by'
            ).get(pk=pk)
        except Sale.DoesNotExist:
            return Response({'error': 'Vente introuvable'}, status=404)

        pdf_path, error = generate_pdf(sale)
        if error:
            return Response({'error': error}, status=500)

        return Response({'message': f'PDF régénéré : {sale.invoice_number}.pdf'})
