from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout 
from django.contrib.auth.forms import UserCreationForm 
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from .api_client import RecommendationAPI
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from .models import ContenidoAudiovisual, Libro, Favorito, ServicioStreaming
from django.db.models import Prefetch
from django.contrib.auth.models import User
import requests
api_client = RecommendationAPI ()

# ... (asegúrate de que api_client = RecommendationAPI() esté arriba)

def index(request):
    """
    Muestra la página de inicio con recomendaciones públicas.
    Si el usuario está autenticado, la navegación debe cambiar en el template.
    """
    # Lógica para cargar recomendaciones públicas
    # Cambia "trending" si quieres otra cosa
    tmdb_results = api_client.search_tmdb(query="trending", media_type="multi") 
    openlibrary_results = api_client.search_open_library(query="best sellers")
    
    recommendations = []
    
    # Ejemplo de mapeo (Asegúrate de que tus resultados finales incluyan 'id_api' y 'tipo')
    for item in tmdb_results[:5]:
        media_type = item.get('media_type')
        if media_type in ['movie', 'tv']:
             recommendations.append({
                'id_api': item.get('id'),
                'tipo': media_type,
                'titulo': item.get('title') or item.get('name'),
                'descripcion': item.get('overview', 'Sin descripción.')
            })

    for item in openlibrary_results[:5]:
        recommendations.append({
            'id_api': item.get('key'),
            'tipo': 'book',
            'titulo': item.get('title', 'Libro sin título'),
            'descripcion': f"Autor: {', '.join(item.get('author_name', ['Desconocido']))}"
        })

    return render(request, 'index.html', {
        'recommendations': recommendations,
        'is_authenticated': request.user.is_authenticated # Clave para el template
    })

def login_view(request):
    """
    Maneja la lógica para el inicio de sesión de usuarios.
    """
    # Si el usuario ya está autenticado, no tiene sentido mostrarle el login.
    if request.user.is_authenticated:
        return redirect('dashboard')
        
    if request.method == 'POST':
        # 1. Obtener los datos del formulario POST
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        # 2. Intentar autenticar al usuario usando las credenciales
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            # 3. Si las credenciales son válidas, iniciar la sesión
            login(request, user)
            messages.success(request, f"¡Bienvenido de nuevo, {username}!")
            # Redirige a la URL de tu dashboard
            return redirect('dashboard') 
        else:
            # 4. Si la autenticación falla (usuario/contraseña incorrectos)
            messages.error(request, 'Nombre de usuario o contraseña incorrectos. Por favor, inténtalo de nuevo.')
            
    # Si es un GET request o la autenticación falló, renderiza la plantilla
    return render(request, 'login.html')

@login_required
def dashboard(request):
    """Dashboard con recomendaciones personalizadas"""
    try:
        # CONTENIDO MÁS ESPECÍFICO Y CONSULTAS MEJORADAS
        tmdb_movies = api_client.search_tmdb(query="popular", media_type="movie")[:12]
        tmdb_series = api_client.search_tmdb(query="popular", media_type="tv")[:12]
        openlibrary_books = api_client.search_open_library(query="bestsellers")[:12]
        
        # DEBUG: Ver qué devuelven las APIs
        print(f"Películas encontradas: {len(tmdb_movies)}")
        print(f"Series encontradas: {len(tmdb_series)}")
        print(f"Libros encontrados: {len(openlibrary_books)}")
        
        # Procesar resultados para formato consistente
        def process_tmdb_items(items, item_type):
            processed = []
            for item in items:
                # Solo procesar si tiene datos básicos
                if item.get('id') and (item.get('title') or item.get('name')):
                    processed.append({
                        'id': item.get('id'),
                        'titulo': item.get('title') or item.get('name'),
                        'descripcion': item.get('overview', 'Sin descripción disponible.'),
                        'tipo': item_type,
                        'imagen': f"https://image.tmdb.org/t/p/w300{item.get('poster_path')}" if item.get('poster_path') else None,
                        'rating': round(item.get('vote_average', 0), 1) if item.get('vote_average') else 'N/A'
                    })
            return processed
        
        def process_book_items(items):
            processed = []
            for item in items:
                if item.get('key') and item.get('title'):
                    processed.append({
                        'id': item.get('key'),
                        'titulo': item.get('title', 'Libro sin título'),
                        'descripcion': f"Autor: {', '.join(item.get('author_name', ['Desconocido']))}",
                        'tipo': 'book',
                        'imagen': f"https://covers.openlibrary.org/b/id/{item.get('cover_i')}-M.jpg" if item.get('cover_i') else None,
                        'year': item.get('first_publish_year', 'N/A')
                    })
            return processed
        
        recommendations = {
            'movies': process_tmdb_items(tmdb_movies, 'movie'),
            'series': process_tmdb_items(tmdb_series, 'tv'),
            'books': process_book_items(openlibrary_books)
        }
        
        print(f"Películas procesadas: {len(recommendations['movies'])}")
        print(f"Series procesadas: {len(recommendations['series'])}")
        print(f"Libros procesados: {len(recommendations['books'])}")
        
        return render(request, 'dashboard.html', {
            'recommendations': recommendations,
            'username': request.user.username
        })
        
    except Exception as e:
        print(f"Error en dashboard: {e}")
        import traceback
        traceback.print_exc()
        
        messages.error(request, f"Error cargando recomendaciones: {str(e)}")
        return render(request, 'dashboard.html', {
            'recommendations': {'movies': [], 'series': [], 'books': []},
            'username': request.user.username
        })

def register_view(request):
    if request.method == 'POST':
        # Obtener datos directamente del request
        username = request.POST.get('username')
        password1 = request.POST.get('password1')
        password2 = request.POST.get('password2')
        first_name = request.POST.get('firstName', '')
        last_name = request.POST.get('lastName', '')
        email = request.POST.get('email', '')
        
        # Validaciones básicas
        if not all([username, password1, password2]):
            messages.error(request, "Todos los campos son obligatorios")
            return render(request, 'register.html')
        
        if password1 != password2:
            messages.error(request, "Las contraseñas no coinciden")
            return render(request, 'register.html')
        
        # CORRECCIÓN: Usar User en lugar de user
        if User.objects.filter(username=username).exists():
            messages.error(request, "Este usuario ya existe")
            return render(request, 'register.html')
        
        # Crear usuario
        try:
            user = User.objects.create_user(
                username=username,
                password=password1,
                first_name=first_name,
                last_name=last_name,
                email=email
            )
            login(request, user)
            messages.success(request, f"¡Cuenta creada con éxito para {user.username}!")
            return redirect('dashboard')
        except Exception as e:
            messages.error(request, f"Error al crear usuario: {str(e)}")
            return render(request, 'register.html')
    
    # GET request
    return render(request, 'register.html')

def logout_view(request):
    logout(request)
    messages.info(request, "Has cerrado tu sesión con éxito.")
    return redirect('index') 

@require_POST
def add_favorite(request):
    """
    Guarda un contenido (película/serie o libro) como favorito del usuario.
    Esta función está diseñada para ser llamada vía AJAX.
    """
    
    # 1. Verificar autenticación
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'Se requiere iniciar sesión.'}, status=401)
    
    # 2. Obtener datos del formulario/petición
    # Usaremos un campo 'tipo' para saber si es TMDb o Open Library
    item_type = request.POST.get('item_type') 
    item_id = request.POST.get('item_id') # tmdb_id o ol_key
    item_title = request.POST.get('item_title')
    
    # Se requiere el tipo y el ID para procesar
    if not item_type or not item_id:
        return JsonResponse({'success': False, 'message': 'Datos de contenido incompletos.'}, status=400)

    try:
        if item_type in ['movie', 'series']:
            # --- GUARDAR CONTENIDO AUDIOVISUAL (TMDb) ---
            
            # 2.1. Buscar o crear el ContenidoAudiovisual en la base de datos local
            contenido, created = ContenidoAudiovisual.objects.get_or_create(
                tmdb_id=item_id,
                defaults={'titulo': item_title, 'tipo': item_type}
            )
            
            # 2.2. Verificar si ya es favorito
            if Favorito.objects.filter(usuario=request.user, contenido_audiovisual=contenido).exists():
                return JsonResponse({'success': True, 'message': 'Ya está en tus favoritos.'})

            # 2.3. Crear el nuevo favorito
            Favorito.objects.create(
                usuario=request.user, 
                contenido_audiovisual=contenido
            )
            
        elif item_type == 'book':
            # --- GUARDAR LIBRO (Open Library) ---
            
            # El ID de Open Library (ol_key) es más complejo, lo manejamos como CharField
            libro, created = Libro.objects.get_or_create(
                ol_key=item_id,
                defaults={'titulo': item_title, 'autor': request.POST.get('item_author', 'Desconocido')}
            )
            
            # Verificar si ya es favorito
            if Favorito.objects.filter(usuario=request.user, libro=libro).exists():
                return JsonResponse({'success': True, 'message': 'Ya está en tus favoritos.'})

            # Crear el nuevo favorito
            Favorito.objects.create(
                usuario=request.user, 
                libro=libro
            )
            
        else:
            return JsonResponse({'success': False, 'message': 'Tipo de contenido no soportado.'}, status=400)

        return JsonResponse({'success': True, 'message': f'{item_title} agregado a favoritos.'})

    except Exception as e:
        # En caso de un error inesperado
        return JsonResponse({'success': False, 'message': f'Error interno: {e}'}, status=500)

@login_required 
def favorites_view(request):
    """
    Muestra la lista de contenidos guardados como favoritos por el usuario.
    """
    
    # 1. Recuperar todos los favoritos del usuario actual.
    # Usamos Prefetch para obtener los datos de ContenidoAudiovisual y Libro en una sola consulta.
    favoritos = Favorito.objects.filter(usuario=request.user).select_related(
        'contenido_audiovisual', 'libro'
    ).order_by('-fecha_agregado')
    
    items_list = []
    
    # 2. Recorrer la lista y formatear los datos para la plantilla
    for fav in favoritos:
        item_data = {
            'fecha_agregado': fav.fecha_agregado,
        }
        
        if fav.contenido_audiovisual:
            # Es una película o serie (TMDb)
            item_data.update({
                'tipo': fav.contenido_audiovisual.tipo,
                'titulo': fav.contenido_audiovisual.titulo,
                'descripcion': fav.contenido_audiovisual.descripcion,
                'id_api': fav.contenido_audiovisual.tmdb_id, # Para futuras llamadas a detalle
            })
        elif fav.libro:
            # Es un libro (Open Library)
            item_data.update({
                'tipo': 'book',
                'titulo': fav.libro.titulo,
                'descripcion': f"Autor: {fav.libro.autor}",
                'id_api': fav.libro.ol_key,
            })
        
        items_list.append(item_data)
        
    return render(request, 'favorites.html', {
        'favorites_list': items_list
    })

@login_required
def settings_view(request):
    """
    Muestra la página de configuración del usuario.
    Aquí se añadiría la lógica para manejar formularios de actualización de perfil.
    """
    # En un proyecto real, se manejarían aquí los formularios de UserChangeForm, etc.
    return render(request, 'settings.html', {
        'username': request.user.username
    })

@login_required
def detail_view(request, item_type, item_id):
    """
    Muestra los detalles completos de una película/serie o libro
    """
    print(f"Detalles solicitados: tipo={item_type}, id={item_id}")
    
    item_details = {}
    error_message = None
    
    try:
        if item_type in ['movie', 'tv']:
            # --- TMDb (Películas/Series) ---
            media_type = 'movie' if item_type == 'movie' else 'tv'
            
            # CORRECCIÓN: Usar las constantes globales directamente
            endpoint = f"https://api.themoviedb.org/3/{media_type}/{item_id}"
            params = {
                'api_key': "79b1de1d435f3be7cc69c4cff49c85e1",  # Tu API key
                'language': 'es-ES'
            }
            
            print(f"Llamando a TMDb: {endpoint}")  # DEBUG
            
            response = requests.get(endpoint, params=params)
            response.raise_for_status()
            item_details = response.json()
            item_details['source'] = 'TMDb'
            item_details['media_type'] = media_type
            
        elif item_type == 'book':
            # --- Open Library (Libros) ---
            # CORRECCIÓN: Usar la constante global directamente
            clean_item_id = item_id.replace(' ', '')
            endpoint = f"http://openlibrary.org{clean_item_id}.json"
            
            print(f"Llamando a Open Library: {endpoint}")  # DEBUG
            
            response = requests.get(endpoint)
            if response.status_code == 200:
                item_details = response.json()
                item_details['source'] = 'Open Library'
            else:
                error_message = "Libro no encontrado en Open Library"
                
        else:
            error_message = "Tipo de contenido no válido"
            
    except requests.RequestException as e:
        print(f"Error en API: {e}")
        error_message = f"Error al obtener detalles: {str(e)}"
    except Exception as e:
        print(f"Error inesperado: {e}")
        error_message = f"Error inesperado: {str(e)}"
    
    if error_message:
        messages.error(request, error_message)
        return redirect('dashboard')
    
    print(f"Detalles obtenidos: {len(item_details)} campos")  # DEBUG
    return render(request, 'detail.html', {
        'details': item_details,
        'item_type': item_type,
        'item_id': item_id
    })

@require_POST
def remove_favorite(request):
    """Eliminar un favorito específico"""
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'Se requiere iniciar sesión.'}, status=401)
    
    item_type = request.POST.get('item_type')
    item_id = request.POST.get('item_id')
    
    try:
        if item_type in ['movie', 'tv']:
            # Buscar y eliminar favorito de contenido audiovisual
            contenido = get_object_or_404(ContenidoAudiovisual, tmdb_id=item_id)
            favorito = get_object_or_404(Favorito, usuario=request.user, contenido_audiovisual=contenido)
            favorito.delete()
            
        elif item_type == 'book':
            # Buscar y eliminar favorito de libro
            libro = get_object_or_404(Libro, ol_key=item_id)
            favorito = get_object_or_404(Favorito, usuario=request.user, libro=libro)
            favorito.delete()
            
        return JsonResponse({'success': True, 'message': 'Favorito eliminado correctamente'})
        
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Error al eliminar favorito: {str(e)}'})

@require_POST
def clear_favorites(request):
    """Eliminar todos los favoritos del usuario"""
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'Se requiere iniciar sesión.'}, status=401)
    
    try:
        # Eliminar todos los favoritos del usuario
        Favorito.objects.filter(usuario=request.user).delete()
        return JsonResponse({'success': True, 'message': 'Todos los favoritos han sido eliminados'})
        
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Error al eliminar favoritos: {str(e)}'})