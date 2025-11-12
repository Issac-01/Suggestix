import requests
import os

TMDB_API_KEY = "79b1de1d435f3be7cc69c4cff49c85e1"
TMDB_BASE_URL = "https://api.themoviedb.org/3"

OPEN_LIBRARY_BASE_URL = "http://openlibrary.org"


class RecommendationAPI:
    """
    Clase para manejar las llamadas a las APIs externas (TMDb y Open Library).
    """
    
    # --- TMDb (PELÍCULAS Y SERIES) ---

    def search_tmdb(self, query: str, media_type: str = 'multi'):
        """Busca contenido en TMDb (películas, series o ambos)."""
        endpoint = f"{TMDB_BASE_URL}/search/{media_type}"
        params = {
            'api_key': TMDB_API_KEY,
            'query': query,
            'language': 'es-ES' 
        }
        
        try:
            response = requests.get(endpoint, params=params)
            response.raise_for_status() 
            return response.json().get('results', [])
        except requests.RequestException as e:
            print(f"Error al conectar con TMDb: {e}")
            return []

    # --- OPEN LIBRARY (LIBROS) ---

    def search_open_library(self, query: str):
        """Busca libros en Open Library por título o autor."""
        endpoint = f"{OPEN_LIBRARY_BASE_URL}/search.json"
        params = {
            'q': query,
            'limit': 10 
        }
        
        try:
            response = requests.get(endpoint, params=params)
            response.raise_for_status()
            return response.json().get('docs', [])
        except requests.RequestException as e:
            print(f"Error al conectar con Open Library: {e}")
            return []