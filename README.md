# StreamAdvisor - Suggestix

Sistema de recomendaciones de películas, series y libros usando Django y APIs externas.

## 🚀 Características

- Registro y autenticación de usuarios
- Recomendaciones de TMDb (películas/series) y Open Library (libros)
- Sistema de favoritos
- Interfaz responsive

## 🛠️ Tecnologías

- Django 5.0
- PostgreSQL
- Docker & Docker Compose
- TMDb API
- Open Library API

## 📦 Instalación

```bash
# Con Docker (recomendado)
git clone https://github.com/Issac-01/suggestix.git
cd streamadvisor-suggestix
docker-compose up

# Sin Docker
git clone https://github.com/Issac-01/suggestix.git
cd streamadvisor-suggestix
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver