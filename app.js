// Global variables
let map = null;
let userMarker = null;
let userCircle = null;
let userLat = 39.1031;
let userLon = -84.512;
let videos = getStorageItem('skystorm_videos');
let photos = getStorageItem('skystorm_photos');
let currentMediaType = 'video';
let weatherUpdateInterval = null;

// Safe localStorage access
function getStorageItem(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : [];
    } catch (e) {
        console.warn(`Storage access failed for ${key}`, e);
        return [];
    }
}

function setStorageItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn(`Storage write failed for ${key}`, e);
    }
}

// Navigation
function initializeNavigation() {
    const navLinks = document.querySelectorAll('[data-section]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-section');
            showSection(sectionId);
        });
    });
}

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }
    
    // Update nav links
    document.querySelectorAll('[data-section]').forEach(link => {
        const isActive = link.getAttribute('data-section') === sectionId;
        link.classList.toggle('active', isActive);
        link.setAttribute('aria-selected', isActive);
    });
    
    // Initialize map if radar section
    if (sectionId === 'radar') {
        if (!map) {
            setTimeout(initMap, 100);
        } else {
            map.invalidateSize();
        }
    }
}

// Gallery
function initializeGallery() {
    const tabs = document.querySelectorAll('.gallery-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => showGalleryTab(tab.getAttribute('data-tab')));
    });
    
    const addVideoBtn = document.getElementById('add-video');
    const addPhotoBtn = document.getElementById('add-photo');
    const mediaForm = document.getElementById('media-form');
    const modalClose = document.querySelector('.modal-close');
    
    if (addVideoBtn) addVideoBtn.addEventListener('click', () => openModal('video'));
    if (addPhotoBtn) addPhotoBtn.addEventListener('click', () => openModal('photo'));
    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (mediaForm) mediaForm.addEventListener('submit', handleMediaSubmit);
    
    renderGallery();
}

function showGalleryTab(tab) {
    document.querySelectorAll('.gallery-tab').forEach(t => {
        const isActive = t.getAttribute('data-tab') === tab;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive);
    });
    
    document.getElementById('videos-gallery').classList.toggle('hidden', tab !== 'videos');
    document.getElementById('photos-gallery').classList.toggle('hidden', tab !== 'photos');
}

function renderGallery() {
    const videoGrid = document.getElementById('video-grid');
    const photoGrid = document.getElementById('photo-grid');
    
    if (videoGrid) {
        let videoHtml = '';
        videos.forEach(v => {
            const ytId = extractYTId(v.url);
            if (ytId) {
                videoHtml += `
                    <div class="video-card">
                        <div class="video-embed">
                            <iframe src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen></iframe>
                        </div>
                        <div class="media-info">
                            <h4>${escapeHtml(v.title)}</h4>
                            <p>${v.date}${v.location ? ` - ${escapeHtml(v.location)}` : ''}</p>
                        </div>
                    </div>
                `;
            }
        });
        videoHtml += '<div class="add-media-card" id="add-video"><i class="fas fa-plus"></i><span>Add Video</span></div>';
        videoGrid.innerHTML = videoHtml;
        document.getElementById('add-video')?.addEventListener('click', () => openModal('video'));
    }
    
    if (photoGrid) {
        let photoHtml = '';
        photos.forEach(p => {
            photoHtml += `
                <div class="photo-card">
                    <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.title)}">
                    <div class="media-info">
                        <h4>${escapeHtml(p.title)}</h4>
                        <p>${p.date}${p.location ? ` - ${escapeHtml(p.location)}` : ''}</p>
                    </div>
                </div>
            `;
        });
        photoHtml += '<div class="add-media-card" id="add-photo"><i class="fas fa-plus"></i><span>Add Photo</span></div>';
        photoGrid.innerHTML = photoHtml;
        document.getElementById('add-photo')?.addEventListener('click', () => openModal('photo'));
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function extractYTId(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^&?]+)/);
    return match && match[1].length === 11 ? match[1] : '';
}

function openModal(type) {
    currentMediaType = type;
    document.getElementById('modal-title').textContent = type === 'video' ? 'Add YouTube Video' : 'Add Photo';
    document.getElementById('media-modal').classList.add('active');
    document.getElementById('media-modal').setAttribute('aria-hidden', 'false');
}

function closeModal() {
    document.getElementById('media-modal').classList.remove('active');
    document.getElementById('media-modal').setAttribute('aria-hidden', 'true');
}

function handleMediaSubmit(e) {
    e.preventDefault();
    const item = {
        url: document.getElementById('media-url').value,
        title: document.getElementById('media-title').value,
        date: document.getElementById('media-date').value,
        location: document.getElementById('media-location').value,
        id: Date.now()
    };
    
    if (currentMediaType === 'video') {
        videos.push(item);
        setStorageItem('skystorm_videos', videos);
    } else {
        photos.push(item);
        setStorageItem('skystorm_photos', photos);
    }
    
    renderGallery();
    closeModal();
    document.getElementById('media-form').reset();
}

// Map
function initMap() {
    if (!document.getElementById('map')) return;
    
    map = L.map('map').setView([userLat, userLon], 8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    try {
        L.tileLayer.wms('https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi', {
            layers: 'nexrad-n0r-900913',
            format: 'image/png',
            transparent: true,
            opacity: 0.6,
            attribution: 'NOAA'
        }).addTo(map);
    } catch (e) {
        console.warn('Radar layer failed to load', e);
    }
    
    updateUserMarker();
    
    // Center map button
    const centerBtn = document.getElementById('center-map');
    if (centerBtn) {
        centerBtn.addEventListener('click', () => {
            if (map) map.setView([userLat, userLon], 10);
        });
    }
}

function updateUserMarker() {
    if (!map) return;
    
    if (userMarker) map.removeLayer(userMarker);
    if (userCircle) map.removeLayer(userCircle);
    
    const icon = L.divIcon({
        className: 'user-icon',
        html: '<div style="width:20px;height:20px;background:#f5a623;border:3px solid #fff;border-radius:50%;box-shadow:0 0 15px #f5a623;"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    userMarker = L.marker([userLat, userLon], { icon: icon }).addTo(map);
    userCircle = L.circle([userLat, userLon], {
        radius: 50000,
        color: '#00cc66',
        fillColor: '#00cc66',
        fillOpacity: 0.1
    }).addTo(map);
}

// GPS
function initGPS() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLat = pos.coords.latitude;
                userLon = pos.coords.longitude;
                
                const gpsStatus = document.getElementById('gps-status');
                if (gpsStatus) {
                    gpsStatus.innerHTML = '<i class="fas fa-location-crosshairs"></i> GPS Active';
                    gpsStatus.style.color = '#00cc66';
                }
                
                if (map) {
                    map.setView([userLat, userLon], 9);
                    updateUserMarker();
                }
                fetchWeather();
            },
            (error) => {
                console.warn('GPS permission denied or unavailable', error);
            }
        );
    }
}

// Weather
function fetchWeather() {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${userLat}&longitude=${userLon}&current=temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=cape,lifted_index`;
    
    fetch(url)
        .then(res => res.json())
        .catch(error => {
            console.error('Weather fetch failed:', error);
            return null;
        })
        .then(data => {
            if (!data || !data.current) return;
            
            updateWeatherDisplay(data);
            updateThreatAssessment(data);
        });
}

function updateWeatherDisplay(data) {
    const c = data.current;
    const h = data.hourly;
    const hi = new Date().getHours();
    
    const temp = Math.round(c.temperature_2m);
    const dew = Math.round(c.dew_point_2m);
    const ws = Math.round(c.wind_speed_10m);
    const wd = Math.round(c.wind_direction_10m);
    const cape = h.cape ? Math.round(h.cape[hi] || 0) : 0;
    const li = h.lifted_index ? h.lifted_index[hi] || 0 : 0;
    
    // Update data panel
    updateElement('temp-value', temp);
    updateElement('home-temp', `${temp}°F`);
    updateElement('dewpoint-value', dew);
    updateElement('home-dewpoint', `${dew}°F`);
    updateElement('wind-speed', ws);
    updateElement('home-wind', `${ws} mph`);
    updateElement('wind-dir', wd);
    updateElement('pressure-value', Math.round(c.surface_pressure));
    updateElement('humidity-value', Math.round(c.relative_humidity_2m));
    updateElement('cape-value', cape);
    updateElement('home-cape', `${cape} J/kg`);
    updateElement('li-value', li.toFixed(1));
    updateElement('lcl-value', Math.round((temp - dew) * 227));
    updateElement('lapse-value', (6.5 + (temp - dew) / 20).toFixed(1));
    updateElement('data-time', new Date().toLocaleTimeString());
    
    // Update progress bars
    const capeBar = document.getElementById('cape-bar');
    if (capeBar) capeBar.style.width = Math.min(cape / 50, 100) + '%';
    
    const lclBar = document.getElementById('lcl-bar');
    if (lclBar) lclBar.style.width = Math.min((temp - dew) * 227 / 10000, 100) + '%';
}

function updateThreatAssessment(data) {
    const c = data.current;
    const h = data.hourly;
    const hi = new Date().getHours();
    
    const cape = h.cape ? Math.round(h.cape[hi] || 0) : 0;
    const li = h.lifted_index ? h.lifted_index[hi] || 0 : 0;
    const temp = Math.round(c.temperature_2m);
    const dew = Math.round(c.dew_point_2m);
    
    let score = 0;
    const threats = [];
    
    if (cape > 2000) {
        score += 30;
        threats.push('High CAPE');
    } else if (cape > 1000) {
        score += 15;
        threats.push('Moderate CAPE');
    }
    
    if (li < -4) {
        score += 20;
        threats.push('Unstable atmosphere');
    }
    
    if ((temp - dew) < 10) {
        score += 10;
        threats.push('Rich moisture');
    }
    
    const threatLevel = document.getElementById('threat-level');
    const threatBar = document.getElementById('threat-bar');
    
    if (threatLevel && threatBar) {
        threatBar.style.width = Math.min(score, 100) + '%';
        
        if (score >= 60) {
            threatLevel.textContent = 'HIGH';
            threatLevel.className = 'threat-level high';
        } else if (score >= 30) {
            threatLevel.textContent = 'MODERATE';
            threatLevel.className = 'threat-level moderate';
        } else {
            threatLevel.textContent = 'LOW';
            threatLevel.className = 'threat-level low';
        }
        
        const threatDetails = document.getElementById('threat-details');
        if (threatDetails) {
            if (threats.length) {
                threatDetails.innerHTML = '<ul>' + threats.map(t => `<li>${escapeHtml(t)}</li>`).join('') + '</ul>';
            } else {
                threatDetails.innerHTML = '<p>No significant threats.</p>';
            }
        }
    }
}

function updateElement(id, content) {
    const element = document.getElementById(id);
    if (element) element.textContent = content;
}

// Upload
function initializeUpload() {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    
    if (uploadZone && fileInput) {
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--accent-primary)';
        });
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.style.borderColor = 'var(--border-color)';
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--border-color)';
            if (e.dataTransfer.files[0]) {
                fileInput.files = e.dataTransfer.files;
            }
        });
    }
}

// Initialization
function init() {
    initializeNavigation();
    initializeGallery();
    initializeUpload();
    initGPS();
    fetchWeather();
    
    // Update weather every 5 minutes
    weatherUpdateInterval = setInterval(fetchWeather, 300000);
}

document.addEventListener('DOMContentLoaded', init);

// Cleanup
window.addEventListener('beforeunload', () => {
    if (weatherUpdateInterval) clearInterval(weatherUpdateInterval);
});