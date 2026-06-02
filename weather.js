// Weather API Integration
// Using Open-Meteo API (free, no API key required) and Geolocation API

const WEATHER_API_BASE = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_API_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

let userCoordinates = null;
let currentLocationName = 'Current Location';

/**
 * Initialize weather on page load
 */
async function initializeWeather() {
    try {
        // Try to get user's current location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    userCoordinates = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    // Reverse geocode to get location name
                    await getLocationName(userCoordinates.latitude, userCoordinates.longitude);
                    await fetchAndDisplayWeather(userCoordinates.latitude, userCoordinates.longitude);
                },
                (error) => {
                    console.log('Geolocation permission denied, using default location');
                    // Use default location (Cincinnati, Ohio Valley)
                    userCoordinates = {
                        latitude: 39.1031,
                        longitude: -84.5120
                    };
                    currentLocationName = 'Cincinnati, OH';
                    fetchAndDisplayWeather(39.1031, -84.5120);
                }
            );
        } else {
            // Geolocation not supported, use default
            userCoordinates = {
                latitude: 39.1031,
                longitude: -84.5120
            };
            currentLocationName = 'Cincinnati, OH';
            fetchAndDisplayWeather(39.1031, -84.5120);
        }
    } catch (error) {
        console.error('Error initializing weather:', error);
        displayWeatherError('Failed to load weather data');
    }

    // Setup event listeners
    setupEventListeners();
}

/**
 * Get location name from coordinates
 */
async function getLocationName(lat, lon) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
        );
        const data = await response.json();
        
        if (data.address) {
            const city = data.address.city || data.address.town || data.address.county || 'Your Location';
            const state = data.address.state || '';
            currentLocationName = state ? `${city}, ${state}` : city;
        }
    } catch (error) {
        console.warn('Could not get location name:', error);
        currentLocationName = 'Your Location';
    }
}

/**
 * Setup event listeners for weather controls
 */
function setupEventListeners() {
    const getWeatherBtn = document.getElementById('get-weather-btn');
    const locationInput = document.getElementById('location-input');

    if (getWeatherBtn) {
        getWeatherBtn.addEventListener('click', async () => {
            const location = locationInput.value.trim();
            if (location && location !== 'Current Location') {
                await searchLocation(location);
            }
        });
    }

    if (locationInput) {
        locationInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const location = locationInput.value.trim();
                if (location && location !== 'Current Location') {
                    await searchLocation(location);
                }
            }
        });
    }
}

/**
 * Search for location by name
 */
async function searchLocation(locationName) {
    try {
        const response = await fetch(
            `${GEOCODING_API_BASE}?name=${encodeURIComponent(locationName)}&count=1&language=en&format=json`
        );
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const latitude = result.latitude;
            const longitude = result.longitude;
            currentLocationName = `${result.name}${result.admin1 ? ', ' + result.admin1 : ''}${result.country ? ', ' + result.country : ''}`;
            
            document.getElementById('location-input').value = currentLocationName;
            await fetchAndDisplayWeather(latitude, longitude);
        } else {
            displayWeatherError('Location not found');
        }
    } catch (error) {
        console.error('Error searching location:', error);
        displayWeatherError('Error searching location');
    }
}

/**
 * Fetch weather data from Open-Meteo API
 */
async function fetchAndDisplayWeather(latitude, longitude) {
    try {
        const params = new URLSearchParams({
            latitude: latitude,
            longitude: longitude,
            current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,precipitation_probability_max',
            timezone: 'auto',
            temperature_unit: 'fahrenheit',
            wind_speed_unit: 'mph',
            precipitation_unit: 'inch',
            forecast_days: 5
        });

        const response = await fetch(`${WEATHER_API_BASE}?${params}`);
        const data = await response.json();

        if (!data.current) {
            displayWeatherError('Could not fetch weather data');
            return;
        }

        displayCurrentWeather(data);
        displayForecast(data);
    } catch (error) {
        console.error('Error fetching weather:', error);
        displayWeatherError('Failed to fetch weather data');
    }
}

/**
 * Display current weather
 */
function displayCurrentWeather(data) {
    const current = data.current;
    const weatherContainer = document.getElementById('weather-container');

    const weatherCode = current.weather_code;
    const weatherDescription = getWeatherDescription(weatherCode);
    const weatherIcon = getWeatherIcon(weatherCode);
    
    const temp = Math.round(current.temperature_2m);
    const feelsLike = Math.round(current.apparent_temperature);
    const humidity = current.relative_humidity_2m;
    const windSpeed = Math.round(current.wind_speed_10m);
    const windDirection = getWindDirection(current.wind_direction_10m);
    const precipitation = current.precipitation || 0;

    const currentWeatherHTML = `
        <div class="current-weather">
            <div class="weather-main">
                <div class="weather-icon">${weatherIcon}</div>
                <div class="weather-info">
                    <h3>${temp}°F</h3>
                    <div class="weather-description">${weatherDescription}</div>
                    <div class="weather-description">Feels like ${feelsLike}°F</div>
                </div>
            </div>
            <div class="weather-stats">
                <div class="weather-stat">
                    <label>Humidity</label>
                    <span class="weather-stat-value">${humidity}%</span>
                </div>
                <div class="weather-stat">
                    <label>Wind Speed</label>
                    <span class="weather-stat-value">${windSpeed} mph</span>
                </div>
                <div class="weather-stat">
                    <label>Wind Direction</label>
                    <span class="weather-stat-value">${windDirection}</span>
                </div>
                <div class="weather-stat">
                    <label>Location</label>
                    <span class="weather-stat-value" style="font-size: 14px;">${currentLocationName}</span>
                </div>
                <div class="weather-stat">
                    <label>Precipitation</label>
                    <span class="weather-stat-value">${precipitation.toFixed(2)}"</span>
                </div>
            </div>
        </div>
    `;

    weatherContainer.innerHTML = currentWeatherHTML;
}

/**
 * Display 5-day forecast
 */
function displayForecast(data) {
    const daily = data.daily;
    const weatherContainer = document.getElementById('weather-container');

    let forecastHTML = '<div class="forecast-section"><h3>5-Day Forecast</h3><div class="forecast-grid">';

    for (let i = 0; i < daily.time.length; i++) {
        const date = new Date(daily.time[i]);
        const dayName = getDayName(date, i);
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const weatherCode = daily.weather_code[i];
        const weatherIcon = getWeatherIcon(weatherCode);
        const weatherDesc = getWeatherDescription(weatherCode);
        const precipProb = daily.precipitation_probability_max[i] || 0;
        const precipAmount = daily.precipitation_sum[i] || 0;

        forecastHTML += `
            <div class="forecast-card">
                <div class="forecast-day">${dayName}</div>
                <div class="forecast-icon">${weatherIcon}</div>
                <div class="forecast-temp">
                    <span class="forecast-high">${maxTemp}°</span>
                    <span class="forecast-low">${minTemp}°</span>
                </div>
                <div class="forecast-condition">${weatherDesc}</div>
                <div class="forecast-condition" style="font-size: 11px; margin-top: 5px;">
                    💧 ${precipProb}% | ${precipAmount.toFixed(1)}"
                </div>
            </div>
        `;
    }

    forecastHTML += '</div></div>';

    weatherContainer.innerHTML += forecastHTML;
}

/**
 * Display weather error message
 */
function displayWeatherError(message) {
    const weatherContainer = document.getElementById('weather-container');
    weatherContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #ff006e;">
            <i class="fas fa-exclamation-circle" style="font-size: 32px; margin-bottom: 15px;"></i>
            <p>${message}</p>
            <p style="font-size: 14px; color: #4a4a6a;">Please check your connection and try again</p>
        </div>
    `;
}

/**
 * Convert WMO weather code to description
 */
function getWeatherDescription(code) {
    const weatherCodes = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        77: 'Snow grains',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        85: 'Slight snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with slight hail',
        99: 'Thunderstorm with heavy hail'
    };
    return weatherCodes[code] || 'Unknown';
}

/**
 * Convert WMO weather code to emoji icon
 */
function getWeatherIcon(code) {
    const icons = {
        0: '☀️',      // Clear
        1: '🌤️',     // Mainly clear
        2: '⛅',      // Partly cloudy
        3: '☁️',      // Overcast
        45: '🌫️',    // Foggy
        48: '🌫️',    // Depositing rime fog
        51: '🌧️',    // Drizzle
        53: '🌧️',
        55: '🌧️',
        61: '🌧️',    // Rain
        63: '🌧️',
        65: '⛈️',
        71: '🌨️',    // Snow
        73: '🌨️',
        75: '🌨️',
        77: '🌨️',
        80: '🌧️',    // Showers
        81: '🌧️',
        82: '⛈️',
        85: '🌨️',    // Snow showers
        86: '🌨️',
        95: '⛈️',    // Thunderstorm
        96: '⛈️',
        99: '⛈️'
    };
    return icons[code] || '🌡️';
}

/**
 * Get day name for forecast
 */
function getDayName(date, index) {
    if (index === 0) {
        return 'Today';
    } else if (index === 1) {
        return 'Tomorrow';
    }
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}

/**
 * Convert wind direction degrees to cardinal direction
 */
function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((degrees + 11.25) / 22.5)) % 16;
    return directions[index];
}

// Initialize weather when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWeather);
} else {
    initializeWeather();
}
