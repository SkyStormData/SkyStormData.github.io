// ===========================
// SkyStorm Data - Main Script
// ===========================

// --- Configuration ---
const WEATHER_API = 'https://api.weather.gov';
const OPENWEATHER_API = 'https://api.openweathermap.org/data/2.5';
const OPENWEATHER_KEY = 'YOUR_API_KEY'; // Replace with actual API key

// --- State Management ---
const state = {
    currentLocation: null,
    weatherData: null,
    isAdmin: false,
    streamActive: false,
    chatMessages: [],
    users: 1
};

// ===========================
// Navigation & Section Management
// ===========================
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            showSection(section);
            
            // Update active states
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

function showSection(sectionId) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(s => s.classList.remove('active'));
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Run section-specific initialization
        if (sectionId === 'radar') initRadarMap();
        if (sectionId === 'data') loadDataSection();
        if (sectionId === 'gallery') loadGallerySection();
    }
}

// ===========================
// Weather Data & Location
// ===========================
function initWeather() {
    const getWeatherBtn = document.getElementById('get-weather-btn');
    const locationInput = document.getElementById('location-input');
    
    if (getWeatherBtn) {
        getWeatherBtn.addEventListener('click', () => {
            const location = locationInput.value;
            if (location !== 'Current Location') {
                getWeatherByLocation(location);
            } else {
                getWeatherByCoords();
            }
        });
    }
    
    // Get initial weather
    getWeatherByCoords();
}

function getWeatherByCoords() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                state.currentLocation = { lat: latitude, lng: longitude };
                fetchWeatherData(latitude, longitude);
            },
            (error) => {
                console.warn('Geolocation error:', error);
                // Fallback to default location (Ohio Valley)
                fetchWeatherData(39.1582, -84.3725); // Cincinnati, OH
            }
        );
    }
}

function getWeatherByLocation(locationName) {
    // Use geocoding API to convert location name to coordinates
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json`)
        .then(r => r.json())
        .then(data => {
            if (data.length > 0) {
                const { lat, lon } = data[0];
                fetchWeatherData(lat, lon);
            } else {
                showError('Location not found');
            }
        })
        .catch(err => console.error('Geocoding error:', err));
}

function fetchWeatherData(lat, lon) {
    // Using Open-Meteo (free, no API key needed)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,dew_point_2m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
    
    fetch(url)
        .then(r => r.json())
        .then(data => {
            state.weatherData = data;
            displayWeather(data);
            updateCurrentConditions(data);
        })
        .catch(err => console.error('Weather fetch error:', err));
}

function displayWeather(data) {
    const container = document.getElementById('weather-container');
    if (!container) return;
    
    const current = data.current;
    const daily = data.daily;
    
    const weatherDescriptions = {
        0: '☀️ Clear',
        1: '🌤️ Mostly Clear',
        2: '⛅ Partly Cloudy',
        3: '☁️ Overcast',
        45: '🌫️ Foggy',
        48: '🌫️ Foggy',
        51: '🌧️ Light Drizzle',
        53: '🌧️ Moderate Drizzle',
        55: '🌧️ Heavy Drizzle',
        61: '🌧️ Light Rain',
        63: '🌧️ Moderate Rain',
        65: '⛈️ Heavy Rain',
        71: '❄️ Light Snow',
        73: '❄️ Moderate Snow',
        75: '❄️ Heavy Snow',
        77: '❄️ Snow Grains',
        80: '🌧️ Light Showers',
        81: '🌧️ Moderate Showers',
        82: '⛈️ Violent Showers',
        85: '❄️ Light Snow Showers',
        86: '❄️ Heavy Snow Showers',
        95: '⛈️ Thunderstorm',
        96: '⛈️ Thunderstorm w/ Hail',
        99: '⛈️ Thunderstorm w/ Hail'
    };
    
    const temp = Math.round(current.temperature_2m * 9/5 + 32); // Convert to Fahrenheit
    const dewpoint = Math.round(current.dew_point_2m * 9/5 + 32);
    const windSpeed = Math.round(current.wind_speed_10m * 0.621371); // Convert to mph
    const description = weatherDescriptions[current.weather_code] || 'Unknown';
    
    let html = `
        <div class="current-weather">
            <div class="weather-main">
                <div class="weather-icon" style="font-size: 80px;">${description.split(' ')[0]}</div>
                <div class="weather-info">
                    <h3>${temp}°F</h3>
                    <p class="weather-description">${description}</p>
                </div>
            </div>
            
            <div class="weather-stats">
                <div class="weather-stat">
                    <label>Humidity</label>
                    <span class="weather-stat-value">${current.relative_humidity_2m}%</span>
                </div>
                <div class="weather-stat">
                    <label>Wind Speed</label>
                    <span class="weather-stat-value">${windSpeed} mph</span>
                </div>
                <div class="weather-stat">
                    <label>Dew Point</label>
                    <span class="weather-stat-value">${dewpoint}°F</span>
                </div>
                <div class="weather-stat">
                    <label>Feels Like</label>
                    <span class="weather-stat-value">${Math.round(temp - 3)}°F</span>
                </div>
            </div>
        </div>
        
        <div class="forecast-section">
            <h3>5-Day Forecast</h3>
            <div class="forecast-grid">
    `;
    
    for (let i = 0; i < Math.min(5, daily.time.length); i++) {
        const date = new Date(daily.time[i]);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const high = Math.round(daily.temperature_2m_max[i] * 9/5 + 32);
        const low = Math.round(daily.temperature_2m_min[i] * 9/5 + 32);
        const code = daily.weather_code[i];
        const desc = weatherDescriptions[code] || 'Unknown';
        
        html += `
            <div class="forecast-card">
                <div class="forecast-day">${dayName}</div>
                <div class="forecast-icon">${desc.split(' ')[0]}</div>
                <div class="forecast-temp">
                    <span class="forecast-high">${high}°</span>
                    <span class="forecast-low">${low}°</span>
                </div>
                <div class="forecast-condition">${desc}</div>
            </div>
        `;
    }
    
    html += '</div></div>';
    container.innerHTML = html;
}

function updateCurrentConditions(data) {
    const current = data.current;
    
    const temp = Math.round(current.temperature_2m * 9/5 + 32);
    const dewpoint = Math.round(current.dew_point_2m * 9/5 + 32);
    const windSpeed = Math.round(current.wind_speed_10m * 0.621371);
    const humidity = current.relative_humidity_2m;
    
    // Update home section condition cards
    const homeTemp = document.getElementById('home-temp');
    const homeHumidity = document.getElementById('home-humidity');
    const homeWind = document.getElementById('home-wind');
    const homeDewpoint = document.getElementById('home-dewpoint');
    
    if (homeTemp) homeTemp.textContent = temp + '°F';
    if (homeHumidity) homeHumidity.textContent = humidity + '%';
    if (homeWind) homeWind.textContent = windSpeed + ' mph';
    if (homeDewpoint) homeDewpoint.textContent = dewpoint + '°F';
    
    // Placeholder for CAPE/DCAPE (would need professional weather API)
    const homeCape = document.getElementById('home-cape');
    const homeDcape = document.getElementById('home-dcape');
    if (homeCape) homeCape.textContent = 'N/A';
    if (homeDcape) homeDcape.textContent = 'N/A';
}

// ===========================
// Radar Map (Leaflet.js)
// ===========================
function initRadarMap() {
    if (window.map) return; // Already initialized
    
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    const center = state.currentLocation || [39.1582, -84.3725]; // Default to Cincinnati
    
    window.map = L.map('map').setView([center.lat || center[0], center.lng || center[1]], 8);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(window.map);
    
    // Add weather radar layer
    L.tileLayer('https://api.rainviewer.com/v1/weather-maps/25/0/0/0/512/{z}/{x}/{y}?key=YOUR_KEY', {
        attribution: 'RainViewer',
        maxZoom: 19,
        opacity: 0.6
    }).addTo(window.map);
}

// ===========================
// Admin Controls
// ===========================
function initAdmin() {
    const adminBtn = document.getElementById('admin-btn');
    const adminModal = document.getElementById('admin-modal');
    const adminForm = document.getElementById('admin-form');
    const closeModal = document.getElementById('close-modal');
    
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            adminModal.classList.add('active');
        });
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            adminModal.classList.remove('active');
        });
    }
    
    if (adminForm) {
        adminForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('admin-username').value;
            const password = document.getElementById('admin-password').value;
            
            if (username === 'admin' && password === 'password123') {
                state.isAdmin = true;
                document.getElementById('admin-controls').style.display = 'flex';
                adminModal.classList.remove('active');
                adminForm.reset();
            } else {
                document.getElementById('admin-error').style.display = 'block';
            }
        });
    }
}

// ===========================
// Live Stream & Chat
// ===========================
function initChat() {
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMessages = document.getElementById('chat-messages');
    
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
}

function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    const chatMessages = document.getElementById('chat-messages');
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message';
    messageEl.innerHTML = `
        <span class="chat-message-author">You</span>
        <span class="chat-message-text">${escapeHtml(message)}</span>
    `;
    
    // Remove placeholder if exists
    const noMessages = chatMessages.querySelector('.no-messages');
    if (noMessages) noMessages.remove();
    
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatInput.value = '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===========================
// Data Section
// ===========================
function loadDataSection() {
    const content = document.getElementById('data-content');
    if (!content || content.textContent !== 'Loading...') return;
    
    const html = `
        <div class="data-dashboard">
            <div class="data-panel main-panel">
                <h3><i class="fas fa-cloud-rain-heavy"></i> Current Soundings</h3>
                <div class="data-grid">
                    <div class="data-item">
                        <div class="data-icon"><i class="fas fa-thermometer-half"></i></div>
                        <div class="data-info">
                            <span class="data-value">--</span>
                            <span class="data-unit">°F</span>
                        </div>
                        <span class="data-label">Surface Temp</span>
                    </div>
                    <div class="data-item">
                        <div class="data-icon"><i class="fas fa-wind"></i></div>
                        <div class="data-info">
                            <span class="data-value">--</span>
                            <span class="data-unit">kt</span>
                        </div>
                        <span class="data-label">Wind Speed</span>
                    </div>
                    <div class="data-item">
                        <div class="data-icon"><i class="fas fa-arrow-up"></i></div>
                        <div class="data-info">
                            <span class="data-value">--</span>
                            <span class="data-unit">ft</span>
                        </div>
                        <span class="data-label">Lifting Level</span>
                    </div>
                </div>
            </div>
            
            <div class="data-panel sounding-panel">
                <h3><i class="fas fa-chart-line"></i> Atmospheric Indices</h3>
                <div class="sounding-grid">
                    <div class="sounding-item">
                        <div class="sounding-header">
                            <span class="sounding-label">CAPE</span>
                            <span class="sounding-desc">Convective Available PE</span>
                        </div>
                        <div class="sounding-value-container">
                            <span class="sounding-value">--</span>
                            <span class="sounding-unit">J/kg</span>
                        </div>
                    </div>
                    <div class="sounding-item">
                        <div class="sounding-header">
                            <span class="sounding-label">CIN</span>
                            <span class="sounding-desc">Convective Inhibition</span>
                        </div>
                        <div class="sounding-value-container">
                            <span class="sounding-value">--</span>
                            <span class="sounding-unit">J/kg</span>
                        </div>
                    </div>
                    <div class="sounding-item">
                        <div class="sounding-header">
                            <span class="sounding-label">Helicity</span>
                            <span class="sounding-desc">Storm Relative</span>
                        </div>
                        <div class="sounding-value-container">
                            <span class="sounding-value">--</span>
                            <span class="sounding-unit">m²/s²</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="data-panel threat-panel">
                <h3><i class="fas fa-exclamation-triangle"></i> Threat Assessment</h3>
                <div class="threat-meter">
                    <div class="threat-level low">LOW</div>
                    <div class="threat-bar-container">
                        <div class="threat-bar" style="width: 20%;"></div>
                    </div>
                    <div class="threat-labels">
                        <span>Low</span>
                        <span>Moderate</span>
                        <span>High</span>
                        <span>Extreme</span>
                    </div>
                </div>
                <div class="threat-details">
                    <p><strong>Current Conditions:</strong> Not in active chase mode.</p>
                    <p style="margin-top: 0.5rem;"><strong>Recommendations:</strong> Monitor conditions for potential development.</p>
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
}

// ===========================
// Gallery Section
// ===========================
function loadGallerySection() {
    const content = document.getElementById('gallery-content');
    if (!content || content.textContent !== 'Loading gallery...') return;
    
    const html = `
        <div class="gallery-header">
            <h2><i class="fas fa-images"></i> Storm Gallery</h2>
            <p>Showcasing severe weather captured across the Ohio Valley</p>
        </div>
        
        <div class="gallery-tabs">
            <button class="gallery-tab active" data-filter="all">All</button>
            <button class="gallery-tab" data-filter="tornado">Tornadoes</button>
            <button class="gallery-tab" data-filter="severe">Severe Storms</button>
            <button class="gallery-tab" data-filter="lightning">Lightning</button>
            <button class="gallery-tab" data-filter="video">Videos</button>
        </div>
        
        <div class="gallery-content">
            <div class="photo-grid">
                <div class="add-media-card">
                    <i class="fas fa-plus-circle"></i>
                    <span>Add Photos</span>
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    
    // Add filter functionality
    document.querySelectorAll('.gallery-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.gallery-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });
}

// ===========================
// Utility Functions
// ===========================
function showError(message) {
    const alertStatus = document.getElementById('alert-status');
    if (alertStatus) {
        alertStatus.classList.add('danger');
        alertStatus.textContent = '⚠️ ' + message;
    }
}

// ===========================
// Initialization
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initWeather();
    initAdmin();
    initChat();
    
    // Set first section as active
    const firstNav = document.querySelector('.nav-link');
    if (firstNav) {
        firstNav.click();
    }
});

// Update user count periodically
setInterval(() => {
    const userCount = document.getElementById('user-count');
    if (userCount) {
        state.users = Math.floor(Math.random() * 50) + 1;
        userCount.textContent = `(${state.users} online)`;
    }
}, 30000);
