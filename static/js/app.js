// Datos de ejemplo mejorados
const sampleData = [
  { 
    id: 'm1', 
    type: 'Película', 
    title: 'Luz de Medianoche', 
    genre: 'Drama', 
    year: 2021, 
    desc: 'Una historia emotiva sobre encuentros inesperados que cambian vidas.',
    rating: 4.2,
    image: '🎬'
  },
  { 
    id: 's1', 
    type: 'Serie', 
    title: 'Código Alfa', 
    genre: 'Ciencia ficción', 
    year: 2023, 
    desc: 'Agentes de élite enfrentan una amenaza tecnológica global.',
    rating: 4.5,
    image: '📺'
  },
  { 
    id: 'b1', 
    type: 'Libro', 
    title: 'El Sendero de los Sueños', 
    genre: 'Fantasía', 
    year: 2019, 
    desc: 'Una aventura épica a través de mundos paralelos y realidades alternativas.',
    rating: 4.7,
    image: '📚'
  },
  { 
    id: 'm2', 
    type: 'Película', 
    title: 'Risa en la Ciudad', 
    genre: 'Comedia', 
    year: 2020, 
    desc: 'Comedia ligera sobre amistad, amor y segundas oportunidades en la gran ciudad.',
    rating: 3.9,
    image: '🎬'
  },
  { 
    id: 's2', 
    type: 'Serie', 
    title: 'Fronteras', 
    genre: 'Acción', 
    year: 2022, 
    desc: 'Intensa caza de contrabandistas internacionales en un futuro cercano.',
    rating: 4.3,
    image: '📺'
  },
  { 
    id: 'b2', 
    type: 'Libro', 
    title: 'El Código del Tiempo', 
    genre: 'Ciencia ficción', 
    year: 2021, 
    desc: 'Thriller científico sobre viajes en el tiempo y paradojas temporales.',
    rating: 4.4,
    image: '📚'
  }
];

// ===== SISTEMA DE BASE DE DATOS Y AUTENTICACIÓN =====

// Clase Redis Simulator
class RedisSimulator {
    constructor() {
        this.data = new Map();
        this.expirations = new Map();
    }

    set(key, value, ttl = null) {
        this.data.set(key, JSON.stringify(value));
        if (ttl) {
            this.expirations.set(key, Date.now() + (ttl * 1000));
        }
        return true;
    }

    get(key) {
        if (this.expirations.has(key) && Date.now() > this.expirations.get(key)) {
            this.del(key);
            return null;
        }
        
        const value = this.data.get(key);
        return value ? JSON.parse(value) : null;
    }

    del(key) {
        this.data.delete(key);
        this.expirations.delete(key);
        return true;
    }

    invalidatePattern(pattern) {
        const keysToDelete = [];
        for (let key of this.data.keys()) {
            if (key.startsWith(pattern.replace('*', ''))) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.del(key));
        return keysToDelete.length;
    }
}

// Clase Database Simulator
class DatabaseSimulator {
    constructor() {
        this.tables = {
            users: this.loadTable('users'),
            user_sessions: this.loadTable('user_sessions'),
            user_preferences: this.loadTable('user_preferences'),
            content: this.loadTable('content'),
            user_favorites: this.loadTable('user_favorites'),
            user_activity: this.loadTable('user_activity')
        };
        
        this.redis = new RedisSimulator();
        this.initializeSampleData();
    }

    loadTable(tableName) {
        const data = localStorage.getItem(`db_${tableName}`);
        return data ? JSON.parse(data) : [];
    }

    saveTable(tableName, data) {
        localStorage.setItem(`db_${tableName}`, JSON.stringify(data));
        return true;
    }

    initializeSampleData() {
        if (this.tables.users.length === 0) {
            this.insert('users', {
                email: 'demo@streamadvisor.com',
                password_hash: this.hashPassword('password123'),
                first_name: 'Usuario',
                last_name: 'Demo',
                avatar: '🎬',
                is_active: true,
                email_verified: true
            });
        }
    }

    // Operaciones de base de datos...
    insert(table, data) {
        const id = this.generateId();
        const record = { 
            id, 
            ...data, 
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        this.tables[table].push(record);
        this.saveTable(table, this.tables[table]);
        this.redis.set(`${table}:${id}`, record);
        return record;
    }

    select(table, where = {}) {
        const cacheKey = `${table}:${JSON.stringify(where)}`;
        const cached = this.redis.get(cacheKey);
        if (cached) return cached;

        let results = this.tables[table];
        Object.keys(where).forEach(key => {
            if (where[key] !== undefined) {
                results = results.filter(record => record[key] === where[key]);
            }
        });
        
        this.redis.set(cacheKey, results, 300);
        return results;
    }

    selectOne(table, where = {}) {
        const cacheKey = `${table}:one:${JSON.stringify(where)}`;
        const cached = this.redis.get(cacheKey);
        if (cached) return cached;

        const results = this.select(table, where);
        const result = results.length > 0 ? results[0] : null;
        this.redis.set(cacheKey, result, 300);
        return result;
    }

    update(table, where, data) {
        const records = this.select(table, where);
        records.forEach(record => {
            Object.assign(record, data, { updated_at: new Date().toISOString() });
            this.redis.set(`${table}:${record.id}`, record);
        });
        
        this.saveTable(table, this.tables[table]);
        this.redis.invalidatePattern(`${table}:*`);
        return records.length;
    }

    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    hashPassword(password) {
        return btoa(password + '_streamadvisor_salt');
    }

    verifyPassword(password, hash) {
        return this.hashPassword(password) === hash;
    }
}

// Servicio de Autenticación
class AuthService {
    constructor() {
        this.db = new DatabaseSimulator();
        this.sessionDuration = 24 * 60 * 60;
    }

    async register(userData) {
        console.log('🔐 Iniciando registro para:', userData.email);
        
        try {
            // Validaciones
            if (!this.isValidEmail(userData.email)) {
                console.log('❌ Email no válido:', userData.email);
                return { success: false, message: 'Email no válido' };
            }

            if (!this.isStrongPassword(userData.password)) {
                console.log('❌ Contraseña débil');
                return { success: false, message: 'La contraseña no cumple con los requisitos de seguridad' };
            }

            // Verificar si el usuario ya existe
            const existingUser = this.db.selectOne('users', { email: userData.email.toLowerCase() });
            if (existingUser) {
                console.log('❌ Usuario ya existe:', userData.email);
                return { success: false, message: 'Este email ya está registrado' };
            }

            console.log('✅ Validaciones pasadas, creando usuario...');

            // Crear usuario en la base de datos
            const newUser = this.db.insert('users', {
                email: userData.email.toLowerCase(),
                password_hash: this.db.hashPassword(userData.password),
                first_name: userData.firstName,
                last_name: userData.lastName,
                avatar: this.getAvatarEmoji(userData.firstName),
                is_active: true,
                email_verified: false,
                preferences: JSON.stringify([])
            });

            console.log('✅ Usuario creado:', newUser.id);

            // Registrar actividad
            this.db.insert('user_activity', {
                user_id: newUser.id,
                activity_type: 'registration',
                description: 'Usuario registrado exitosamente'
            });

            // Crear sesión
            const session = await this.createSession(newUser.id);
            console.log('✅ Sesión creada:', session.token);

            return {
                success: true,
                message: 'Usuario registrado exitosamente',
                user: this.sanitizeUser(newUser),
                session: session.token
            };

        } catch (error) {
            console.error('❌ Error en registro:', error);
            return { success: false, message: 'Error interno del servidor' };
        }
    }

    async login(email, password) {
        try {
            const user = this.db.selectOne('users', { 
                email: email.toLowerCase(),
                is_active: true 
            });

            if (!user) {
                return { success: false, message: 'Credenciales incorrectas' };
            }

            if (!this.db.verifyPassword(password, user.password_hash)) {
                return { success: false, message: 'Credenciales incorrectas' };
            }

            const session = await this.createSession(user.id);

            this.db.insert('user_activity', {
                user_id: user.id,
                activity_type: 'login_success',
                description: 'Inicio de sesión exitoso'
            });

            this.db.update('users', { id: user.id }, { 
                last_login: new Date().toISOString() 
            });

            return {
                success: true,
                message: 'Inicio de sesión exitoso',
                user: this.sanitizeUser(user),
                session: session.token
            };

        } catch (error) {
            console.error('Error en login:', error);
            return { success: false, message: 'Error interno del servidor' };
        }
    }

    async createSession(userId) {
        const token = this.generateToken();
        const expiresAt = new Date(Date.now() + (this.sessionDuration * 1000));

        const sessionData = {
            user_id: userId,
            token: token,
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString(),
            user_agent: navigator.userAgent
        };

        this.db.redis.set(`session:${token}`, sessionData, this.sessionDuration);
        this.db.insert('user_sessions', sessionData);

        return { token, expiresAt };
    }

    async verifySession(token) {
        try {
            const session = this.db.redis.get(`session:${token}`);
            
            if (!session) {
                return { success: false, message: 'Sesión inválida o expirada' };
            }

            if (new Date(session.expires_at) < new Date()) {
                this.db.redis.del(`session:${token}`);
                return { success: false, message: 'Sesión expirada' };
            }

            const user = this.db.selectOne('users', { id: session.user_id });
            
            if (!user || !user.is_active) {
                this.db.redis.del(`session:${token}`);
                return { success: false, message: 'Usuario no encontrado o inactivo' };
            }

            // Extender sesión
            this.db.redis.set(`session:${token}`, {
                ...session,
                expires_at: new Date(Date.now() + (this.sessionDuration * 1000)).toISOString()
            }, this.sessionDuration);

            return {
                success: true,
                user: this.sanitizeUser(user),
                session: session
            };

        } catch (error) {
            console.error('Error verificando sesión:', error);
            return { success: false, message: 'Error interno del servidor' };
        }
    }

    async logout(token) {
        try {
            const session = this.db.redis.get(`session:${token}`);
            
            if (session) {
                this.db.insert('user_activity', {
                    user_id: session.user_id,
                    activity_type: 'logout',
                    description: 'Cierre de sesión'
                });

                this.db.redis.del(`session:${token}`);
                this.db.update('user_sessions', { token }, { 
                    is_active: false,
                    logged_out_at: new Date().toISOString()
                });
            }

            return { success: true, message: 'Sesión cerrada correctamente' };

        } catch (error) {
            console.error('Error en logout:', error);
            return { success: false, message: 'Error interno del servidor' };
        }
    }

    generateToken() {
        return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
    }

    sanitizeUser(user) {
        const { password_hash, ...sanitizedUser } = user;
        return sanitizedUser;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isStrongPassword(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
    }

    getAvatarEmoji(name) {
        const emojis = ['🎬', '🌟', '🎭', '📺', '🎪', '🎨', '👑', '🔥', '✨', '🎯'];
        const index = name.length % emojis.length;
        return emojis[index];
    }
}

// Instancia global
const authService = new AuthService();

// ===== GESTIÓN DE SESIÓN EN CLIENTE =====
function getCurrentSession() {
    return localStorage.getItem('session_token');
}

function saveSession(token) {
    localStorage.setItem('session_token', token);
}

function clearSession() {
    localStorage.removeItem('session_token');
    localStorage.removeItem('current_user');
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('current_user') || 'null');
}

// Funciones de almacenamiento (mantener compatibilidad)
function getPrefs(){ 
    const user = getCurrentUser();
    return user && user.preferences ? JSON.parse(user.preferences) : [];
}

async function savePrefs(preferences) {
    const user = getCurrentUser();
    if (user) {
        // Aquí integrarías con el backend real para guardar preferencias
        const updatedUser = { ...user, preferences: JSON.stringify(preferences) };
        localStorage.setItem('current_user', JSON.stringify(updatedUser));
    }
    localStorage.setItem('prefs', JSON.stringify(preferences));
}

function getFavs(){ 
    return JSON.parse(localStorage.getItem('favs') || '[]'); 
}

function saveFavs(arr){ 
    localStorage.setItem('favs', JSON.stringify(arr)); 
}

// Funciones mejoradas para el componente de usuario
function updateUserDisplay() {
    const user = getCurrentUser();
    const userName = document.getElementById('userName');
    const userStatus = document.getElementById('userStatus');
    const userAvatar = document.getElementById('userAvatar');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const authButtons = document.getElementById('authButtons');
    
    if (user) {
        userName.textContent = `${user.first_name} ${user.last_name}`;
        userStatus.textContent = 'Conectado';
        userStatus.className = 'user-status';
        userAvatar.innerHTML = user.avatar;
        userAvatar.setAttribute('data-tooltip', `Hola, ${user.first_name}!`);
        userAvatar.classList.add('pulse');
        
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (authButtons) authButtons.style.display = 'none';
    } else {
        userName.textContent = 'Invitado';
        userStatus.textContent = 'Sin conexión';
        userStatus.className = 'user-status offline';
        userAvatar.innerHTML = '👤';
        userAvatar.setAttribute('data-tooltip', 'Haz clic para iniciar sesión');
        userAvatar.classList.remove('pulse');
        
        if (loginBtn) loginBtn.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (authButtons) authButtons.style.display = 'flex';
    }
}

function getAvatarEmoji(name) {
    const emojis = ['🎬', '🌟', '🎭', '📺', '🎪', '🎨', '👑', '🔥'];
    const index = name.length % emojis.length;
    return emojis[index];
}

// Hacer el avatar clickeable para login
document.addEventListener('DOMContentLoaded', function() {
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
        userAvatar.addEventListener('click', function() {
            if (!getUser()) {
                fakeLogin();
            }
        });
    }
    updateUserDisplay();
});

// Algoritmo de recomendaciones mejorado
function getRecommendations() {
  const prefs = getPrefs();
  const favs = getFavs();
  const allItems = [...sampleData];
  
  // Si no hay preferencias, mostrar todos los elementos ordenados por rating
  if (prefs.length === 0) {
    return allItems.sort((a, b) => b.rating - a.rating);
  }
  
  // Filtrar por preferencias y ordenar por relevancia
  const recommended = allItems
    .map(item => {
      let score = 0;
      
      // Puntuar por género preferido
      if (prefs.includes(item.genre)) {
        score += 10;
      }
      
      // Puntuar por tipo de contenido favorito (basado en favoritos existentes)
      const userFavTypes = favs.map(id => {
        const favItem = sampleData.find(d => d.id === id);
        return favItem ? favItem.type : null;
      }).filter(Boolean);
      
      if (userFavTypes.includes(item.type)) {
        score += 5;
      }
      
      // Puntuar por rating
      score += item.rating;
      
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score);
  
  return recommended;
}

// ===== FUNCIONES DE AUTENTICACIÓN MEJORADAS =====
async function handleRegistration(formData) {
    try {
        const submitBtn = document.getElementById('registerSubmitBtn');
        const btnText = document.getElementById('registerBtnText');
        const spinner = document.getElementById('registerSpinner');
        
        if (submitBtn) {
            submitBtn.disabled = true;
            btnText.textContent = 'Creando cuenta...';
            spinner.style.display = 'inline-block';
        }

        const result = await authService.register(formData);
        
        if (result.success) {
            saveSession(result.session);
            localStorage.setItem('current_user', JSON.stringify(result.user));
            
            showNotification(`¡Bienvenido a StreamAdvisor, ${formData.firstName}!`, 'success');
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showNotification(result.message, 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                btnText.textContent = 'Crear Cuenta';
                spinner.style.display = 'none';
            }
        }
        
    } catch (error) {
        showNotification('Error en el registro', 'error');
        const submitBtn = document.getElementById('registerSubmitBtn');
        const btnText = document.getElementById('registerBtnText');
        const spinner = document.getElementById('registerSpinner');
        if (submitBtn) {
            submitBtn.disabled = false;
            btnText.textContent = 'Crear Cuenta';
            spinner.style.display = 'none';
        }
    }
}

async function handleLogin(email, password) {
    try {
        const submitBtn = document.getElementById('loginSubmitBtn');
        const btnText = document.getElementById('loginBtnText');
        const spinner = document.getElementById('loginSpinner');
        
        if (submitBtn) {
            submitBtn.disabled = true;
            btnText.textContent = 'Iniciando sesión...';
            spinner.style.display = 'inline-block';
        }

        const result = await authService.login(email, password);
        
        if (result.success) {
            saveSession(result.session);
            localStorage.setItem('current_user', JSON.stringify(result.user));
            
            showNotification(`¡Bienvenido de vuelta, ${result.user.first_name}!`, 'success');
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            showNotification(result.message, 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                btnText.textContent = 'Iniciar Sesión';
                spinner.style.display = 'none';
            }
        }
        
    } catch (error) {
        showNotification('Error en el inicio de sesión', 'error');
        const submitBtn = document.getElementById('loginSubmitBtn');
        const btnText = document.getElementById('loginBtnText');
        const spinner = document.getElementById('loginSpinner');
        if (submitBtn) {
            submitBtn.disabled = false;
            btnText.textContent = 'Iniciar Sesión';
            spinner.style.display = 'none';
        }
    }
}

async function handleLogout() {
    try {
        const token = getCurrentSession();
        if (token) {
            await authService.logout(token);
        }
        
        clearSession();
        showNotification('Sesión cerrada correctamente', 'info');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        
    } catch (error) {
        console.error('Error en logout:', error);
        clearSession();
        window.location.href = 'index.html';
    }
}

// ===== VERIFICACIÓN AUTOMÁTICA DE SESIÓN =====
async function checkAuthentication() {
    const token = getCurrentSession();
    
    if (!token) {
        return false;
    }
    
    try {
        const result = await authService.verifySession(token);
        
        if (result.success) {
            localStorage.setItem('current_user', JSON.stringify(result.user));
            return true;
        } else {
            clearSession();
            return false;
        }
    } catch (error) {
        console.error('Error verificando sesión:', error);
        clearSession();
        return false;
    }
}

// Mantener fakeLogin para compatibilidad (opcional)
function fakeLogin() {
    // Redirigir a login real en lugar de crear usuario demo
    window.location.href = 'login.html';
}

function applyFilters() {
  const container = document.getElementById('recommendations');
  if (!container) return;

  const filteredRecommendations = getFilteredRecommendations();
  
  container.innerHTML = '';
  
  if (filteredRecommendations.length === 0) {
    container.innerHTML = `
      <div class="no-results">
        <p class="muted">No se encontraron resultados con los filtros aplicados.</p>
        <button class="btn btn-primary" onclick="clearFilters()">Mostrar todo</button>
      </div>
    `;
    return;
  }
  
  filteredRecommendations.forEach(d => {
    const el = document.createElement('div'); 
    el.className = `content-card ${d.type.toLowerCase()}`;
    el.innerHTML = `
      <div class="card-image">${d.image}</div>
      <div class="card-content">
        <span class="card-type">${d.type}</span>
        <h3 class="card-title">${d.title}</h3>
        <p class="card-description">${d.desc}</p>
        <div class="card-meta">
          <span>${d.year} · ${d.genre}</span>
          <div class="card-rating">
            <span>⭐</span>
            <span>${d.rating}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-outline" onclick="goToDetail('${d.id}')">Ver detalle</button>
          <button class="btn ${isFav(d.id) ? 'btn-secondary' : 'btn-primary'}" onclick="toggleFav('${d.id}')">
            ${isFav(d.id) ? '❤️ Quitar' : '🤍 Favorito'}
          </button>
        </div>
      </div>
    `;
    container.appendChild(el);
  });

  // Mostrar contador de resultados
  updateResultsCounter(filteredRecommendations.length);
}

function clearFilters() {
  // Restablecer filtros
  const typeFilter = document.getElementById('typeFilter');
  const genreFilter = document.getElementById('genreFilter');
  const sortFilter = document.getElementById('sortFilter');
  const searchFilter = document.getElementById('searchFilter');
  
  if (typeFilter) typeFilter.value = 'all';
  if (genreFilter) genreFilter.value = 'all';
  if (sortFilter) sortFilter.value = 'rating';
  if (searchFilter) searchFilter.value = '';
  
  // Aplicar filtros (que ahora mostrarán todo)
  applyFilters();
}

function updateResultsCounter(count) {
  // Buscar o crear el contador de resultados
  let counter = document.getElementById('resultsCounter');
  if (!counter) {
    counter = document.createElement('div');
    counter.id = 'resultsCounter';
    counter.className = 'results-counter';
    const filtersBar = document.querySelector('.filters-bar');
    if (filtersBar) {
      filtersBar.appendChild(counter);
    }
  }
  
  counter.textContent = `${count} resultado${count !== 1 ? 's' : ''} encontrado${count !== 1 ? 's' : ''}`;
}

// Renderizado de recomendaciones
function renderRecommendations(){
  const container = document.getElementById('recommendations');
  if(!container) {
    console.log('Contenedor de recomendaciones no encontrado');
    return;
  }

  // Usar applyFilters en lugar de la lógica original
  applyFilters();
}

// Gestión de favoritos
function isFav(id){ 
  return getFavs().includes(id); 
}

function toggleFav(id){
  const user = getUser();
  if (!user) {
    alert('Debes iniciar sesión para guardar favoritos');
    return;
  }
  
  const favs = getFavs();
  const idx = favs.indexOf(id);
  if(idx > -1){ 
    favs.splice(idx,1); 
  } else { 
    favs.push(id); 
  }
  saveFavs(favs);
  renderRecommendations();
  renderFavorites();
  updateUserUI();
}

// Navegación
function goToDetail(id){
  window.location.href = `detail.html?id=${id}`;
}

// Renderizado de detalle
function renderDetail(){
  const el = document.getElementById('detail');
  if(!el) return;
  
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const item = sampleData.find(x => x.id === id);
  
  if(!item){ 
    el.innerHTML = '<p>Elemento no encontrado. <a href="dashboard.html">Volver al explorador</a></p>'; 
    return; 
  }
  
  el.innerHTML = `
    <div class="detail-header">
      <div class="detail-image ${item.type.toLowerCase()}">${item.image}</div>
      <div class="detail-info">
        <h2>${item.title} <small class="meta">(${item.type} · ${item.year})</small></h2>
        <p class="meta">Género: ${item.genre} · Rating: ⭐ ${item.rating}</p>
        <p>${item.desc}</p>
        <div class="actions">
          <button class="btn ${isFav(item.id) ? 'btn-secondary' : 'btn-primary'}" onclick="toggleFav('${item.id}')">
            ${isFav(item.id) ? '❤️ Quitar favorito' : '🤍 Agregar favorito'}
          </button>
          <a class="btn btn-outline" href="dashboard.html">Volver a explorar</a>
        </div>
      </div>
    </div>
    <div class="recommendations-section">
      <h3>Contenido similar</h3>
      <div id="similarContent" class="content-grid"></div>
    </div>
  `;
  
  // Mostrar contenido similar
  renderSimilarContent(item);
}

function renderSimilarContent(item) {
  const container = document.getElementById('similarContent');
  if (!container) return;
  
  const similar = sampleData
    .filter(d => d.id !== item.id && (d.genre === item.genre || d.type === item.type))
    .slice(0, 3);
  
  container.innerHTML = '';
  
  if (similar.length === 0) {
    container.innerHTML = '<p class="muted">No hay contenido similar disponible.</p>';
    return;
  }
  
  similar.forEach(d => {
    const el = document.createElement('div'); 
    el.className = `content-card ${d.type.toLowerCase()}`;
    el.innerHTML = `
      <div class="card-image">${d.image}</div>
      <div class="card-content">
        <span class="card-type">${d.type}</span>
        <h3 class="card-title">${d.title}</h3>
        <p class="card-description">${d.desc}</p>
        <div class="card-meta">
          <span>${d.year} · ${d.genre}</span>
          <div class="card-rating">
            <span>⭐</span>
            <span>${d.rating}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-outline" onclick="goToDetail('${d.id}')">Ver detalle</button>
        </div>
      </div>
    `;
    container.appendChild(el);
  });
}

// Renderizado de favoritos
function renderFavorites(){
  const container = document.getElementById('favoritesList');
  const noFav = document.getElementById('noFav');
  if(!container) return;
  
  const favs = getFavs();
  container.innerHTML = '';
  
  if(favs.length === 0){ 
    if(noFav) noFav.style.display='block'; 
    return; 
  }
  
  if(noFav) noFav.style.display='none';
  
  favs.forEach(id => {
    const d = sampleData.find(x => x.id === id);
    if(!d) return;
    
    const el = document.createElement('div'); 
    el.className = `content-card ${d.type.toLowerCase()}`;
    el.innerHTML = `
      <div class="card-image">${d.image}</div>
      <div class="card-content">
        <span class="card-type">${d.type}</span>
        <h3 class="card-title">${d.title}</h3>
        <p class="card-description">${d.desc}</p>
        <div class="card-meta">
          <span>${d.year} · ${d.genre}</span>
          <div class="card-rating">
            <span>⭐</span>
            <span>${d.rating}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-outline" onclick="goToDetail('${d.id}')">Ver detalle</button>
          <button class="btn btn-secondary" onclick="toggleFav('${d.id}')">Quitar favorito</button>
        </div>
      </div>
    `;
    container.appendChild(el);
  });
}

// Gestión de preferencias
function initPrefsForm(){
  const form = document.getElementById('prefsForm');
  if(!form) return;
  
  const prefs = getPrefs();
  const inputs = form.querySelectorAll('input[name="genres"]');
  inputs.forEach(i => { 
    i.checked = prefs.includes(i.value); 
  });
  
  form.addEventListener('submit', e => {
    e.preventDefault();
    const selected = Array.from(inputs).filter(x => x.checked).map(x => x.value);
    savePrefs(selected);
    
    // Mostrar notificación de éxito
    showNotification('Preferencias guardadas correctamente', 'success');
    
    // Redirigir después de guardar
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);
  });
}

// Autenticación simulada mejorada
function fakeLogin() {
  const users = [
    { name: 'Alex Rivera', email: 'alex@example.com' },
    { name: 'Sofía Martínez', email: 'sofia@example.com' },
    { name: 'Carlos López', email: 'carlos@example.com' },
    { name: 'Isabel Chen', email: 'isabel@example.com' }
  ];
  
  const randomUser = users[Math.floor(Math.random() * users.length)];
  saveUser(randomUser);
  
  // Mostrar mensaje de bienvenida
  showWelcomeMessage(randomUser.name);
  updateUserDisplay();
  
  // Recargar recomendaciones si estamos en dashboard
  if (typeof renderRecommendations === 'function') {
    setTimeout(renderRecommendations, 500);
  }
}

function showWelcomeMessage(name) {
  // Crear notificación de bienvenida
  const welcomeMsg = document.createElement('div');
  welcomeMsg.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
    z-index: 1000;
    animation: slideIn 0.5s ease;
  `;
  welcomeMsg.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <span style="font-size: 1.2rem;">🎉</span>
      <div>
        <strong>¡Bienvenido, ${name}!</strong>
        <div style="font-size: 0.875rem; opacity: 0.9;">Tus recomendaciones han sido actualizadas</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(welcomeMsg);
  
  setTimeout(() => {
    welcomeMsg.style.animation = 'slideOut 0.5s ease';
    setTimeout(() => {
      document.body.removeChild(welcomeMsg);
    }, 500);
  }, 3000);
}

function logout(){
  localStorage.removeItem('user');
  updateUserDisplay();
  showNotification('Sesión cerrada', 'info');
  
  // Recargar recomendaciones si estamos en el dashboard
  if (window.location.pathname.includes('dashboard.html')) {
    renderRecommendations();
  }
}

function updateUserUI(){
  updateUserDisplay();
}

// Notificaciones
function showNotification(message, type = 'info') {
  // Crear elemento de notificación
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()">×</button>
  `;
  
  // Estilos para la notificación
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: var(--border-radius);
    color: white;
    font-weight: 500;
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;
  
  // Colores según el tipo
  if (type === 'success') {
    notification.style.background = '#28a745';
  } else if (type === 'error') {
    notification.style.background = '#dc3545';
  } else {
    notification.style.background = 'var(--primary)';
  }
  
  // Botón de cerrar
  notification.querySelector('button').style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  document.body.appendChild(notification);
  
  // Auto-eliminar después de 5 segundos
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// Inicialización
window.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded - Inicializando app');
  
  // Verificar autenticación primero
  await checkAuthentication();
  
  renderRecommendations();
  renderFavorites();
  renderDetail();
  initPrefsForm();
  updateUserDisplay(); // Cambiado de updateUserUI a updateUserDisplay
});

// Agregar keyframes para animaciones
const additionalCSS = `
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}
`;

// Inyectar los keyframes al documento
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// ===== SISTEMA DE AUTENTICACIÓN MEJORADO =====

// Base de datos simulada de usuarios
const usersDB = JSON.parse(localStorage.getItem('streamadvisor_users') || '[]');

// Guardar usuarios en localStorage
function saveUsersDB() {
  localStorage.setItem('streamadvisor_users', JSON.stringify(usersDB));
}

// Función para registrar nuevo usuario
function handleRegistration() {
  const form = document.getElementById('registerForm');
  const submitBtn = document.getElementById('registerBtnText');
  const spinner = document.getElementById('registerSpinner');
  
  // Validar formulario
  if (!validateRegistrationForm()) {
    return;
  }
  
  // Mostrar loading
  submitBtn.textContent = 'Creando cuenta...';
  spinner.style.display = 'inline-block';
  
  // Simular proceso de registro
  setTimeout(() => {
    const formData = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('registerEmail').value.trim().toLowerCase(),
      password: document.getElementById('registerPassword').value,
      preferences: [],
      joinDate: new Date().toISOString(),
      avatar: getAvatarEmoji(document.getElementById('firstName').value.trim())
    };
    
    // Verificar si el usuario ya existe
    if (usersDB.find(user => user.email === formData.email)) {
      showFormError('registerEmailError', 'Este correo electrónico ya está registrado');
      submitBtn.textContent = 'Crear Cuenta';
      spinner.style.display = 'none';
      return;
    }
    
    // Hashear contraseña (simulado)
    formData.password = btoa(formData.password); // En un caso real, usaríamos bcrypt
    
    // Guardar usuario
    usersDB.push(formData);
    saveUsersDB();
    
    // Iniciar sesión automáticamente
    const user = {
      id: generateUserId(),
      name: `${formData.firstName} ${formData.lastName}`,
      email: formData.email,
      joinDate: formData.joinDate,
      avatar: formData.avatar
    };
    
    saveUser(user);
    
    // Mostrar mensaje de éxito
    showNotification(`¡Bienvenido a StreamAdvisor, ${formData.firstName}!`, 'success');
    
    // Redirigir al dashboard
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);
    
  }, 1500);
}

// Función para iniciar sesión
function handleLogin() {
  const form = document.getElementById('loginForm');
  const submitBtn = document.getElementById('loginBtnText');
  const spinner = document.getElementById('loginSpinner');
  
  // Validar formulario
  if (!validateLoginForm()) {
    return;
  }
  
  // Mostrar loading
  submitBtn.textContent = 'Iniciando sesión...';
  spinner.style.display = 'inline-block';
  
  // Simular proceso de login
  setTimeout(() => {
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    
    // Buscar usuario
    const userData = usersDB.find(user => user.email === email);
    
    if (!userData) {
      showFormError('emailError', 'Correo electrónico no registrado');
      submitBtn.textContent = 'Iniciar Sesión';
      spinner.style.display = 'none';
      return;
    }
    
    // Verificar contraseña (simulado)
    if (btoa(password) !== userData.password) {
      showFormError('passwordError', 'Contraseña incorrecta');
      submitBtn.textContent = 'Iniciar Sesión';
      spinner.style.display = 'none';
      return;
    }
    
    // Crear objeto de usuario para la sesión
    const user = {
      id: generateUserId(),
      name: `${userData.firstName} ${userData.lastName}`,
      email: userData.email,
      joinDate: userData.joinDate,
      avatar: userData.avatar
    };
    
    // Recordar sesión si está marcado
    const rememberMe = document.getElementById('rememberMe').checked;
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true');
    }
    
    saveUser(user);
    
    // Mostrar mensaje de bienvenida
    showWelcomeMessage(user.name);
    updateUserDisplay();
    
    // Redirigir al dashboard
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1000);
    
  }, 1500);
}

// Función para recuperación de contraseña
function handlePasswordRecovery() {
  const email = document.getElementById('recoveryEmail').value.trim().toLowerCase();
  
  if (!email) {
    showNotification('Por favor ingresa tu correo electrónico', 'error');
    return;
  }
  
  // Simular envío de correo
  showNotification('Se ha enviado un enlace de recuperación a tu correo electrónico', 'success');
  closeModal('forgotPasswordModal');
  
  // Limpiar formulario
  document.getElementById('recoveryEmail').value = '';
}

// Validación del formulario de registro
function validateRegistrationForm() {
  let isValid = true;
  
  // Limpiar errores anteriores
  clearFormErrors();
  
  // Validar nombre
  const firstName = document.getElementById('firstName').value.trim();
  if (!firstName) {
    showFormError('firstNameError', 'El nombre es obligatorio');
    isValid = false;
  }
  
  // Validar apellido
  const lastName = document.getElementById('lastName').value.trim();
  if (!lastName) {
    showFormError('lastNameError', 'El apellido es obligatorio');
    isValid = false;
  }
  
  // Validar email
  const email = document.getElementById('registerEmail').value.trim();
  if (!email) {
    showFormError('registerEmailError', 'El correo electrónico es obligatorio');
    isValid = false;
  } else if (!isValidEmail(email)) {
    showFormError('registerEmailError', 'Ingresa un correo electrónico válido');
    isValid = false;
  }
  
  // Validar contraseña
  const password = document.getElementById('registerPassword').value;
  if (!password) {
    showFormError('registerPasswordError', 'La contraseña es obligatoria');
    isValid = false;
  } else if (!isStrongPassword(password)) {
    showFormError('registerPasswordError', 'La contraseña no cumple con los requisitos de seguridad');
    isValid = false;
  }
  
  // Validar confirmación de contraseña
  const confirmPassword = document.getElementById('confirmPassword').value;
  if (password !== confirmPassword) {
    showFormError('confirmPasswordError', 'Las contraseñas no coinciden');
    isValid = false;
  }
  
  // Validar términos y condiciones
  const acceptTerms = document.getElementById('acceptTerms').checked;
  if (!acceptTerms) {
    showNotification('Debes aceptar los términos y condiciones', 'error');
    isValid = false;
  }
  
  return isValid;
}

// Validación del formulario de login
function validateLoginForm() {
  let isValid = true;
  
  // Limpiar errores anteriores
  clearFormErrors();
  
  // Validar email
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    showFormError('emailError', 'El correo electrónico es obligatorio');
    isValid = false;
  } else if (!isValidEmail(email)) {
    showFormError('emailError', 'Ingresa un correo electrónico válido');
    isValid = false;
  }
  
  // Validar contraseña
  const password = document.getElementById('loginPassword').value;
  if (!password) {
    showFormError('passwordError', 'La contraseña es obligatoria');
    isValid = false;
  }
  
  return isValid;
}

// Validar fortaleza de contraseña en tiempo real
function validatePasswordStrength(password) {
  const strengthBar = document.getElementById('passwordStrength');
  const strengthText = document.getElementById('passwordStrengthText');
  const requirements = {
    length: document.getElementById('reqLength'),
    upper: document.getElementById('reqUpper'),
    lower: document.getElementById('reqLower'),
    number: document.getElementById('reqNumber'),
    special: document.getElementById('reqSpecial')
  }};
  
  let strength = 0;
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
  
  // Actualizar requisitos
  Object.keys(checks).forEach(key => {
    if (checks[key]) {
      requirements[key].classList.add('valid');
      strength++;
    } else {
      requirements[key].classList.remove('valid');
    }
  });
  
  // Actualizar barra de fortaleza
  const strengthLevels = ['strength-weak', 'strength-fair', 'strength-good', 'strength-strong'];

  // ===== FUNCIONES DE REDIRECCIÓN Y GESTIÓN DE BOTONES =====

// Función para redirigir a login
function redirectToLogin() {
  window.location.href = 'login.html';
}

// Función para redirigir a registro
function redirectToRegister() {
  window.location.href = 'register.html';
}

// Actualizar visibilidad de botones de autenticación
function updateAuthButtonsVisibility() {
  const user = getUser();
  const authButtons = document.getElementById('authButtons');
  const authHeroButtons = document.getElementById('authHeroButtons');
  const ctaSection = document.getElementById('ctaSection');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (user) {
    // Usuario logueado - ocultar botones de autenticación
    if (authButtons) authButtons.style.display = 'none';
    if (authHeroButtons) authHeroButtons.style.display = 'none';
    if (ctaSection) ctaSection.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'block';
  } else {
    // Usuario no logueado - mostrar botones de autenticación
    if (authButtons) authButtons.style.display = 'flex';
    if (authHeroButtons) authHeroButtons.style.display = 'flex';
    if (ctaSection) ctaSection.style.display = 'block';
    if (loginBtn) loginBtn.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

// Actualizar la función updateUserDisplay para incluir botones
function updateUserDisplay() {
  const user = getUser();
  const userName = document.getElementById('userName');
  const userStatus = document.getElementById('userStatus');
  const userAvatar = document.getElementById('userAvatar');
  
  if (user) {
    const userData = user;
    userName.textContent = userData.name;
    userStatus.textContent = 'Conectado';
    userStatus.className = 'user-status';
    userAvatar.innerHTML = getAvatarEmoji(userData.name);
    userAvatar.setAttribute('data-tooltip', `Hola, ${userData.name}!`);
    userAvatar.classList.add('pulse');
  } else {
    userName.textContent = 'Invitado';
    userStatus.textContent = 'Sin conexión';
    userStatus.className = 'user-status offline';
    userAvatar.innerHTML = '👤';
    userAvatar.setAttribute('data-tooltip', 'Haz clic para iniciar sesión');
    userAvatar.classList.remove('pulse');
  }
  
  // Actualizar visibilidad de botones
  updateAuthButtonsVisibility();
}