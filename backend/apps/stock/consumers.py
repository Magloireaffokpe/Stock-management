import json
from channels.generic.websocket import AsyncWebsocketConsumer


class StockConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer pour les mises à jour de stock en temps réel.
    Toutes les instances React connectées reçoivent les événements.
    """
    GROUP_NAME = 'stock_alerts'

    async def connect(self):
        await self.channel_layer.group_add(self.GROUP_NAME, self.channel_name)
        await self.accept()
        # Confirmer la connexion au client
        await self.send(text_data=json.dumps({'type': 'CONNECTED', 'message': 'WebSocket connecté'}))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.GROUP_NAME, self.channel_name)

    async def receive(self, text_data):
        """
        Peut recevoir des messages du client (ex: ping keep-alive).
        """
        try:
            data = json.loads(text_data)
            if data.get('type') == 'PING':
                await self.send(text_data=json.dumps({'type': 'PONG'}))
        except json.JSONDecodeError:
            pass

    # ── Handlers des messages broadcastés depuis les signals ────

    async def stock_update(self, event):
        """Mise à jour d'un stock produit"""
        await self.send(text_data=json.dumps({
            'type':          'STOCK_UPDATE',
            'product_id':    event['product_id'],
            'product_name':  event['product_name'],
            'stock_quantity': event['stock_quantity'],
            'stock_status':  event['stock_status'],
        }))

    async def stock_alert(self, event):
        """Nouvelle alerte de stock (faible / critique / rupture)"""
        await self.send(text_data=json.dumps({
            'type':         'STOCK_ALERT',
            'product_id':   event['product_id'],
            'product_name': event['product_name'],
            'alert_level':  event['alert_level'],
            'stock_quantity': event['stock_quantity'],
        }))
