from django.db import models
from django.contrib.auth.models import User

# --- 1. MODELOS DE CONTENIDO ---

# Modelo para representar un servicio de streaming (Netflix, HBO, etc.)
class ServicioStreaming(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    
    def __str__(self):
        return self.nombre

# Modelo principal para películas y series (datos de TMDb)
class ContenidoAudiovisual(models.Model):
    # ID único asignado por The Movie Database (TMDb)
    tmdb_id = models.IntegerField(unique=True, null=True, blank=True) 

    titulo = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, null=True)
    tipo = models.CharField(max_length=100) # 'movie' o 'tv'
    genero = models.CharField(max_length=200, blank=True, null=True)
    
    # Un contenido puede estar disponible en varios servicios (ej. Netflix y Amazon Prime)
    servicios = models.ManyToManyField(ServicioStreaming, related_name='contenidos_audiovisuales', blank=True)
    
    def __str__(self):
        return f"{self.titulo} ({self.tipo})"

# Modelo para representar Libros (datos de Open Library)
class Libro(models.Model):
    # ID único asignado por Open Library
    ol_key = models.CharField(max_length=50, unique=True, null=True, blank=True) 
    
    titulo = models.CharField(max_length=255)
    autor = models.CharField(max_length=255)
    sinopsis = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return f"Libro: {self.titulo} de {self.autor}"

# --- 2. MODELO DE USUARIO / FAVORITOS ---

# Modelo para guardar los favoritos (puede ser audiovisual o libro)
class Favorito(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favoritos')
    
    # Campo genérico que apunta al contenido (puede ser nulo)
    contenido_audiovisual = models.ForeignKey(ContenidoAudiovisual, on_delete=models.CASCADE, null=True, blank=True)
    libro = models.ForeignKey(Libro, on_delete=models.CASCADE, null=True, blank=True)
    
    fecha_agregado = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        # Aquí se necesita una validación adicional a nivel de aplicación para asegurar
        # que solo se selecciona uno (contenido o libro).
        pass 

    def __str__(self):
        item = self.contenido_audiovisual if self.contenido_audiovisual else self.libro
        return f"Favorito de {self.usuario.username}: {item.titulo if item else 'N/A'}"