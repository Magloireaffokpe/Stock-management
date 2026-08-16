from rest_framework import serializers
from .models import Store


class StoreSerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)
    category_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Store
        fields = ['id', 'name', 'slug', 'is_active', 'order', 'created_at', 'product_count', 'category_count']
        read_only_fields = ['id', 'created_at', 'slug', 'product_count', 'category_count']

    def validate(self, attrs):
        if not self.instance and 'is_active' not in attrs:
            attrs['is_active'] = True
        name = attrs.get('name')
        instance = self.instance
        if name:
            from django.utils.text import slugify
            slug = slugify(name) or name
            qs = Store.objects.filter(slug=slug)
            if instance:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"name": "Une boutique porte déjà ce nom (ou un nom très proche)."}
                )
        return attrs
