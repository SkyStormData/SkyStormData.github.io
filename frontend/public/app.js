// ========================================
// SKYSTORM DATA - Storm Chaser Command Center
// ========================================

// ========== Global State ==========
let map;
let userMarker;
let userCircle;
let warningLayers = [];
let radarLayer;
let userLat = 39.1031; // Default: Columbus, OH
let userLon = -84.5120;
let weatherData = {};
let uploadedData = null;
let dataChart = null;

// Gallery storage (localStorage)
let videos = JSON.parse(localStorage.getItem('skystorm_videos')) || [];
let photos = JSON.parse(localStorage.getItem('skystorm_photos')) || [];

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initMap();
    initGPS();
    initGallery();
    initUpload();
    fetchWeatherData();
    fetchWarnings();
    
    // Refresh data every 5 minutes
    setInterval(() => {
        fetchWeatherData();
        fetchWarnings();
    }, 300000);
});

// ========== Navigation ==========
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-section');

            // Update active states
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');

            // Resize map if radar section
            if (sectionId === 'radar' && map) {
                setTimeout(() => map.invalidateSize(), 100);
            }
        });
    });
}

// ========== Map & Radar ==========
function initMap() {
    map = L.map('map', {
        center: [userLat, userLon],
        zoom: 8,
        zoomControl: false
    });

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CartoDB',
        maxZoom: 19
    }).addTo(map);

    // Add zoom control to top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Add NWS radar overlay
    radarLayer = L.tileLayer.wms('https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi', {
        layers: 'nexrad-n0r-900913',
        format: 'image/png',
        transparent: true,
        opacity: 0.6
    }).addTo(map);

    // Control buttons
    document.getElementById('center-location').addEventListener('click', () => {
        map.setView([userLat, userLon], 10);
    });

    document.getElementById('toggle-warnings').addEventListener('click', (e) => {
        e.target.classList.toggle('active');
        warningLayers.forEach(layer => {
            if (e.target.classList.contains('active')) {
                layer.addTo(map);
            } else {
                map.removeLayer(layer);
            }
        });
    });

    document.getElementById('toggle-radar').addEventListener('click', (e) => {
        e.target.classList.toggle('active');
        if (e.target.classList.contains('active')) {
            radarLayer.addTo(map);
        } else {
            map.removeLayer(radarLayer);
        }
    });
}

function updateUserPosition(lat, lon) {
    userLat = lat;
    userLon = lon;

    // Remove existing markers
    if (userMarker) map.removeLayer(userMarker);
    if (userCircle) map.removeLayer(userCircle);

    // Custom user icon
    const userIcon = L.divIcon({
        className: 'user-location-icon',
        html: `<div style="
            width: 20px;
            height: 20px;
            background: #f5a623;
            border: 3px solid #fff;
            border-radius: 50%;
            box-shadow: 0 0 15px #f5a623;
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map);

    // Status circle - will be updated based on warnings
    userCircle = L.circle([lat, lon], {
        radius: 50000, // 50km
        color: '#00cc66',
        fillColor: '#00cc66',
        fillOpacity: 0.1,
        weight: 2
    }).addTo(map);

    // Update GPS status
    document.getElementById('gps-status').innerHTML = '<i class="fas fa-location-crosshairs"></i> GPS Active';
    document.getElementById('gps-status').style.color = '#00cc66';
}

function updateSafetyStatus(status) {
    const alertStatus = document.getElementById('alert-status');
    const statusClasses = ['safe', 'caution', 'danger'];
    
    alertStatus.classList.remove(...statusClasses);
    
    if (status === 'danger') {
        alertStatus.classList.add('danger');
        alertStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> DANGER';
        if (userCircle) {
            userCircle.setStyle({ color: '#ff3b3b', fillColor: '#ff3b3b' });
        }
    } else if (status === 'caution') {
        alertStatus.classList.add('caution');
        alertStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> CAUTION';
        if (userCircle) {
            userCircle.setStyle({ color: '#ffcc00', fillColor: '#ffcc00' });
        }
    } else {
        alertStatus.classList.add('safe');
        alertStatus.innerHTML = '<i class="fas fa-shield"></i> SAFE';
        if (userCircle) {
            userCircle.setStyle({ color: '#00cc66', fillColor: '#00cc66' });
        }
    }
}

// ========== GPS ==========
function initGPS() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                updateUserPosition(position.coords.latitude, position.coords.longitude);
                map.setView([position.coords.latitude, position.coords.longitude], 9);
                fetchWeatherData();
                fetchWarnings();
            },
            (error) => {
                console.log('GPS error:', error);
                document.getElementById('gps-status').innerHTML = '<i class="fas fa-location-crosshairs"></i> GPS Off';
                updateUserPosition(userLat, userLon);
            },
            { enableHighAccuracy: true }
        );

        // Watch position for continuous updates
        navigator.geolocation.watchPosition(
            (position) => {
                updateUserPosition(position.coords.latitude, position.coords.longitude);
            },
            null,
            { enableHighAccuracy: true }
        );
    }
}

// ========== Weather Data (Open-Meteo API) ==========
async function fetchWeatherData() {
    try {
        // Fetch current weather and atmospheric data
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${userLat}&longitude=${userLon}` +
            `&current=temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,wind_direction_10m` +
            `&hourly=cape,lifted_index,convective_inhibition` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
        );
        const data = await response.json();
        
        weatherData = data;
        updateWeatherDisplay(data);
    } catch (error) {
        console.error('Weather fetch error:', error);
    }
}

function updateWeatherDisplay(data) {
    const current = data.current;
    const hourly = data.hourly;
    const currentHourIndex = new Date().getHours();

    // Temperature (already in Fahrenheit)
    const temp = Math.round(current.temperature_2m);
    document.getElementById('temp-value').textContent = temp;
    document.getElementById('home-temp').textContent = temp + '°F';

    // Dew Point
    const dewpoint = Math.round(current.dew_point_2m);
    document.getElementById('dewpoint-value').textContent = dewpoint;
    document.getElementById('home-dewpoint').textContent = dewpoint + '°F';

    // Wind Speed & Direction
    const windSpeed = Math.round(current.wind_speed_10m);
    const windDir = Math.round(current.wind_direction_10m);
    document.getElementById('wind-speed').textContent = windSpeed;
    document.getElementById('wind-dir').textContent = windDir;
    document.getElementById('home-wind').textContent = windSpeed + ' mph ' + getWindDirection(windDir);

    // Pressure
    document.getElementById('pressure-value').textContent = Math.round(current.surface_pressure);

    // Humidity
    document.getElementById('humidity-value').textContent = Math.round(current.relative_humidity_2m);

    // CAPE (from hourly data)
    const cape = hourly.cape ? hourly.cape[currentHourIndex] || 0 : 0;
    document.getElementById('cape-value').textContent = Math.round(cape);
    document.getElementById('home-cape').textContent = Math.round(cape) + ' J/kg';
    document.getElementById('cape-bar').style.width = Math.min(cape / 50, 100) + '%';

    // Lifted Index
    const li = hourly.lifted_index ? hourly.lifted_index[currentHourIndex] || 0 : 0;
    document.getElementById('li-value').textContent = li.toFixed(1);
    document.getElementById('li-bar').style.width = Math.max(0, Math.min(100, (10 - li) * 5)) + '%';

    // CIN
    const cin = hourly.convective_inhibition ? Math.abs(hourly.convective_inhibition[currentHourIndex]) || 0 : 0;
    document.getElementById('cin-value').textContent = Math.round(cin);
    document.getElementById('cin-bar').style.width = Math.min(cin / 2, 100) + '%';

    // Calculate approximate LCL (simplified formula)
    const lcl = calculateLCL(temp, dewpoint);
    document.getElementById('lcl-value').textContent = Math.round(lcl);
    document.getElementById('lcl-bar').style.width = Math.min(lcl / 100, 100) + '%';

    // Calculate approximate lapse rate (using temp spread as proxy)
    const lapseRate = 6.5 + (temp - dewpoint) / 20;
    document.getElementById('lapse-value').textContent = lapseRate.toFixed(1);
    document.getElementById('lapse-bar').style.width = Math.min((lapseRate - 4) * 20, 100) + '%';

    // SRH placeholder (would need sounding data)
    document.getElementById('srh-value').textContent = '--';

    // Update timestamp
    document.getElementById('data-time').textContent = new Date().toLocaleTimeString();

    // Update threat assessment
    updateThreatAssessment(cape, li, cin, temp, dewpoint);
}

function calculateLCL(tempF, dewpointF) {
    // Simplified LCL calculation (Espy's equation approximation)
    const spread = tempF - dewpointF;
    const lclFeet = spread * 227; // Approximate feet per degree F spread
    return lclFeet;
}

function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

function updateThreatAssessment(cape, li, cin, temp, dewpoint) {
    let threatScore = 0;
    let threats = [];

    // CAPE contribution
    if (cape > 3000) {
        threatScore += 35;
        threats.push('Extreme instability (CAPE > 3000)');
    } else if (cape > 2000) {
        threatScore += 25;
        threats.push('Strong instability (CAPE > 2000)');
    } else if (cape > 1000) {
        threatScore += 15;
        threats.push('Moderate instability');
    } else if (cape > 500) {
        threatScore += 5;
    }

    // LI contribution
    if (li < -6) {
        threatScore += 25;
        threats.push('Very unstable atmosphere (LI < -6)');
    } else if (li < -4) {
        threatScore += 15;
        threats.push('Unstable atmosphere');
    } else if (li < -2) {
        threatScore += 5;
    }

    // CIN (inhibition reduces threat temporarily)
    if (cin > 100) {
        threatScore -= 10;
        threats.push('Strong cap present - storms unlikely until broken');
    }

    // Moisture
    const spread = temp - dewpoint;
    if (spread < 10) {
        threatScore += 10;
        threats.push('Rich low-level moisture');
    }

    // Normalize score
    threatScore = Math.max(0, Math.min(100, threatScore));

    // Update display
    const threatLevel = document.getElementById('threat-level');
    const threatBar = document.getElementById('threat-bar');
    const threatDetails = document.getElementById('threat-details');

    threatBar.style.width = threatScore + '%';

    if (threatScore >= 75) {
        threatLevel.textContent = 'EXTREME';
        threatLevel.className = 'threat-level extreme';
    } else if (threatScore >= 50) {
        threatLevel.textContent = 'HIGH';
        threatLevel.className = 'threat-level high';
    } else if (threatScore >= 25) {
        threatLevel.textContent = 'MODERATE';
        threatLevel.className = 'threat-level moderate';
    } else {
        threatLevel.textContent = 'LOW';
        threatLevel.className = 'threat-level low';
    }

    if (threats.length > 0) {
        threatDetails.innerHTML = '<ul>' + threats.map(t => `<li>${t}</li>`).join('') + '</ul>';
    } else {
        threatDetails.innerHTML = '<p>No significant severe weather indicators at this time.</p>';
    }
}

// ========== NWS Warnings ==========
async function fetchWarnings() {
    try {
        // Clear existing warning layers
        warningLayers.forEach(layer => map.removeLayer(layer));
        warningLayers = [];

        // Fetch active alerts for the area
        const response = await fetch(
            `https://api.weather.gov/alerts/active?point=${userLat},${userLon}&status=actual`
        );
        const data = await response.json();

        const warningsList = document.getElementById('warnings-list');
        let userStatus = 'safe';

        if (data.features && data.features.length > 0) {
            warningsList.innerHTML = '';

            data.features.forEach(alert => {
                const props = alert.properties;
                const event = props.event.toLowerCase();

                // Determine warning color
                let color = '#00ccff'; // default
                let warningClass = '';

                if (event.includes('tornado')) {
                    color = '#ff00ff';
                    warningClass = 'tornado';
                    userStatus = 'danger';
                } else if (event.includes('severe thunderstorm')) {
                    color = '#ff6600';
                    warningClass = 'severe';
                    if (userStatus !== 'danger') userStatus = 'caution';
                } else if (event.includes('flash flood')) {
                    color = '#00ff00';
                    warningClass = 'flood';
                    if (userStatus !== 'danger') userStatus = 'caution';
                }

                // Add polygon to map if geometry exists
                if (alert.geometry) {
                    const layer = L.geoJSON(alert.geometry, {
                        style: {
                            color: color,
                            fillColor: color,
                            fillOpacity: 0.3,
                            weight: 2
                        }
                    }).addTo(map);

                    layer.bindPopup(`<strong>${props.event}</strong><br>${props.headline || ''}`);
                    warningLayers.push(layer);
                }

                // Add to warnings list
                const warningItem = document.createElement('div');
                warningItem.className = `warning-item ${warningClass}`;
                warningItem.innerHTML = `
                    <h4>${props.event}</h4>
                    <p>${props.areaDesc || 'Area not specified'}</p>
                    <p style="font-size: 0.75rem; color: var(--text-muted);">
                        Expires: ${new Date(props.expires).toLocaleString()}
                    </p>
                `;
                warningsList.appendChild(warningItem);
            });
        } else {
            warningsList.innerHTML = '<p class="no-warnings">No active warnings in your area</p>';
        }

        updateSafetyStatus(userStatus);

    } catch (error) {
        console.error('Warnings fetch error:', error);
    }
}

// ========== Gallery ==========
function initGallery() {
    // Tab switching
    document.querySelectorAll('.gallery-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.gallery-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabName = tab.getAttribute('data-tab');
            document.getElementById('videos-gallery').classList.toggle('hidden', tabName !== 'videos');
            document.getElementById('photos-gallery').classList.toggle('hidden', tabName !== 'photos');
        });
    });

    // Add media buttons
    document.getElementById('add-video').addEventListener('click', () => openMediaModal('video'));
    document.getElementById('add-photo').addEventListener('click', () => openMediaModal('photo'));

    // Modal close
    document.querySelector('.modal-close').addEventListener('click', closeMediaModal);
    document.getElementById('media-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('media-modal')) closeMediaModal();
    });

    // Form submit
    document.getElementById('media-form').addEventListener('submit', handleMediaSubmit);

    // Load saved media
    renderGallery();
}

function openMediaModal(type) {
    document.getElementById('modal-title').textContent = type === 'video' ? 'Add YouTube Video' : 'Add Photo';
    document.getElementById('media-url').placeholder = type === 'video' ? 'Paste YouTube URL' : 'Paste image URL';
    document.getElementById('media-modal').classList.add('active');
    document.getElementById('media-modal').setAttribute('data-type', type);
}

function closeMediaModal() {
    document.getElementById('media-modal').classList.remove('active');
    document.getElementById('media-form').reset();
}

function handleMediaSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('media-modal').getAttribute('data-type');
    const url = document.getElementById('media-url').value;
    const title = document.getElementById('media-title').value;
    const date = document.getElementById('media-date').value;
    const location = document.getElementById('media-location').value;

    const mediaItem = { url, title, date, location, id: Date.now() };

    if (type === 'video') {
        videos.push(mediaItem);
        localStorage.setItem('skystorm_videos', JSON.stringify(videos));
    } else {
        photos.push(mediaItem);
        localStorage.setItem('skystorm_photos', JSON.stringify(photos));
    }

    renderGallery();
    closeMediaModal();
}

function renderGallery() {
    // Render videos
    const videoGrid = document.getElementById('video-grid');
    videoGrid.innerHTML = videos.map(video => {
        const videoId = extractYouTubeId(video.url);
        return `
            <div class="video-card">
                <div class="video-embed">
                    <iframe src="https://www.youtube.com/embed/${videoId}" 
                            frameborder="0" allowfullscreen></iframe>
                </div>
                <div class="media-info">
                    <h4>${video.title}</h4>
                    <p>${video.location || ''} ${video.date ? '• ' + video.date : ''}</p>
                </div>
            </div>
        `;
    }).join('') + `
        <div class="add-media-card" id="add-video">
            <i class="fas fa-plus"></i>
            <span>Add YouTube Video</span>
        </div>
    `;

    // Render photos
    const photoGrid = document.getElementById('photo-grid');
    photoGrid.innerHTML = photos.map(photo => `
        <div class="photo-card">
            <img src="${photo.url}" alt="${photo.title}" onerror="this.src='https://via.placeholder.com/400x200?text=Image+Not+Found'">
            <div class="media-info">
                <h4>${photo.title}</h4>
                <p>${photo.location || ''} ${photo.date ? '• ' + photo.date : ''}</p>
            </div>
        </div>
    `).join('') + `
        <div class="add-media-card" id="add-photo">
            <i class="fas fa-plus"></i>
            <span>Add Photo URL</span>
        </div>
    `;

    // Re-attach event listeners
    document.getElementById('add-video').addEventListener('click', () => openMediaModal('video'));
    document.getElementById('add-photo').addEventListener('click', () => openMediaModal('photo'));
}

function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// ========== Upload ==========
function initUpload() {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');

    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) processFile(file);
    });

    document.getElementById('clear-upload').addEventListener('click', clearUpload);
    document.getElementById('download-data').addEventListener('click', downloadProcessedData);
    document.getElementById('visualize-data').addEventListener('click', visualizeData);
}

function processFile(file) {
    const fileName = file.name;
    const extension = fileName.split('.').pop().toLowerCase();

    if (!['csv', 'json'].includes(extension)) {
        alert('Please upload a CSV or JSON file');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            if (extension === 'json') {
                uploadedData = JSON.parse(e.target.result);
            } else {
                uploadedData = parseCSV(e.target.result);
            }
            displayUploadPreview(fileName, uploadedData);
        } catch (error) {
            alert('Error parsing file: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index];
        });
        data.push(row);
    }

    return data;
}

function displayUploadPreview(fileName, data) {
    document.getElementById('upload-zone').style.display = 'none';
    document.getElementById('upload-preview').classList.remove('hidden');
    document.getElementById('file-name').textContent = fileName;

    const previewContent = document.getElementById('preview-content');
    
    if (Array.isArray(data) && data.length > 0) {
        const headers = Object.keys(data[0]);
        const rows = data.slice(0, 10); // Show first 10 rows

        previewContent.innerHTML = `
            <table class="preview-table">
                <thead>
                    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>
                    `).join('')}
                </tbody>
            </table>
            <p style="margin-top: 1rem; color: var(--text-muted); font-size: 0.85rem;">
                Showing ${rows.length} of ${data.length} rows
            </p>
        `;
    } else {
        previewContent.innerHTML = '<pre>' + JSON.stringify(data, null, 2).slice(0, 1000) + '</pre>';
    }

    // Save to history
    saveUploadHistory(fileName, data.length || 1);
}

function clearUpload() {
    uploadedData = null;
    document.getElementById('upload-zone').style.display = 'flex';
    document.getElementById('upload-preview').classList.add('hidden');
    document.getElementById('data-visualization').classList.add('hidden');
    document.getElementById('file-input').value = '';
}

function downloadProcessedData() {
    if (!uploadedData) return;
    
    const blob = new Blob([JSON.stringify(uploadedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'processed_data.json';
    a.click();
    URL.revokeObjectURL(url);
}

function visualizeData() {
    if (!uploadedData || !Array.isArray(uploadedData)) return;

    document.getElementById('data-visualization').classList.remove('hidden');

    // Try to find numeric columns for visualization
    const headers = Object.keys(uploadedData[0]);
    const numericHeaders = headers.filter(h => {
        const val = uploadedData[0][h];
        return !isNaN(parseFloat(val));
    });

    if (numericHeaders.length === 0) {
        document.getElementById('data-visualization').innerHTML = 
            '<p style="color: var(--text-muted);">No numeric data found for visualization</p>';
        return;
    }

    // Create chart
    const ctx = document.getElementById('data-chart').getContext('2d');
    
    if (dataChart) dataChart.destroy();

    const labels = uploadedData.map((_, i) => `Point ${i + 1}`);
    const datasets = numericHeaders.slice(0, 3).map((header, index) => ({
        label: header,
        data: uploadedData.map(row => parseFloat(row[header]) || 0),
        borderColor: ['#f5a623', '#ff6b35', '#00cc66'][index],
        backgroundColor: ['rgba(245, 166, 35, 0.1)', 'rgba(255, 107, 53, 0.1)', 'rgba(0, 204, 102, 0.1)'][index],
        tension: 0.4
    }));

    dataChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#fff' }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#a0a0b0' },
                    grid: { color: '#2a2a3a' }
                },
                y: {
                    ticks: { color: '#a0a0b0' },
                    grid: { color: '#2a2a3a' }
                }
            }
        }
    });
}

function saveUploadHistory(fileName, rowCount) {
    const history = JSON.parse(localStorage.getItem('skystorm_uploads')) || [];
    history.unshift({
        name: fileName,
        rows: rowCount,
        date: new Date().toLocaleString()
    });
    localStorage.setItem('skystorm_uploads', JSON.stringify(history.slice(0, 10)));
    renderUploadHistory();
}

function renderUploadHistory() {
    const history = JSON.parse(localStorage.getItem('skystorm_uploads')) || [];
    const container = document.getElementById('upload-history-list');

    if (history.length === 0) {
        container.innerHTML = '<p class="no-history">No recent uploads</p>';
        return;
    }

    container.innerHTML = history.map(item => `
        <div style="padding: 0.75rem; background: var(--bg-card); border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
            <strong>${item.name}</strong>
            <span style="color: var(--text-muted); font-size: 0.85rem;"> • ${item.rows} rows • ${item.date}</span>
        </div>
    `).join('');
}

// Initialize upload history on load
document.addEventListener('DOMContentLoaded', renderUploadHistory);
