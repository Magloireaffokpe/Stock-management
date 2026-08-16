from django.db import models
from django.utils.text import slugify

class Store(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or 'boutique'
            self.slug = base
            n = 1
            while Store.objects.filter(slug=self.slug).exclude(pk=self.pk).exists():
                n += 1
                self.slug = f'{base}-{n}'
        super().save(*args, **kwargs)
