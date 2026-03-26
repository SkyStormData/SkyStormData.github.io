import { useEffect, useState, useRef } from "react";
import "./App.css";

// ========== Global State ==========
let map;
let userMarker;
let userCircle;
let warningLayers = [];
let radarLayer;

function App() {
  const [activeSection, setActiveSection] = useState('home');
  const [userLat, setUserLat] = useState(39.1031);
  const [userLon, setUserLon] = useState(-84.5120);
  const [gpsStatus, setGpsStatus] = useState('GPS Off');
  const [alertStatus, setAlertStatus] = useState('safe');
  const [weatherData, setWeatherData] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [videos, setVideos] = useState(() => JSON.parse(localStorage.getItem('skystorm_videos')) || []);
  const [photos, setPhotos] = useState(() => JSON.parse(localStorage.getItem('skystorm_photos')) || []);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('video');
  const [uploadedData, setUploadedData] = useState(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [showVisualization, setShowVisualization] = useState(false);
  
  const mapRef = useRef(null);
  const mapInitialized = useRef(false);
  const chartRef = useRef(null);
  const dataChartInstance = useRef(null);

  // Initialize on mount
  useEffect(() => {
    initGPS();
  }, []);

  // Initialize map when radar section is active
  useEffect(() => {
    if (activeSection === 'radar' && !mapInitialized.current) {
      setTimeout(() => initMap(), 100);
    }
    if (activeSection === 'radar' && map) {
      setTimeout(() => map.invalidateSize(), 100);
    }
  }, [activeSection]);

  // Fetch weather data when location changes
  useEffect(() => {
    fetchWeatherData();
    fetchWarnings();
    const interval = setInterval(() => {
      fetchWeatherData();
      fetchWarnings();
    }, 300000);
    return () => clearInterval(interval);
  }, [userLat, userLon]);

  const initGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLat(position.coords.latitude);
          setUserLon(position.coords.longitude);
          setGpsStatus('GPS Active');
        },
        () => setGpsStatus('GPS Off'),
        { enableHighAccuracy: true }
      );
      navigator.geolocation.watchPosition(
        (position) => {
          setUserLat(position.coords.latitude);
          setUserLon(position.coords.longitude);
        },
        null,
        { enableHighAccuracy: true }
      );
    }
  };

  const initMap = () => {
    if (mapInitialized.current || !mapRef.current) return;
    
    const L = window.L;
    if (!L) return;

    map = L.map(mapRef.current, {
      center: [userLat, userLon],
      zoom: 8,
      zoomControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CartoDB',
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    radarLayer = L.tileLayer.wms('https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi', {
      layers: 'nexrad-n0r-900913',
      format: 'image/png',
      transparent: true,
      opacity: 0.6
    }).addTo(map);

    updateUserMarker(userLat, userLon);
    mapInitialized.current = true;
  };

  const updateUserMarker = (lat, lon) => {
    if (!map) return;
    const L = window.L;
    
    if (userMarker) map.removeLayer(userMarker);
    if (userCircle) map.removeLayer(userCircle);

    const userIcon = L.divIcon({
      className: 'user-location-icon',
      html: `<div style="width:20px;height:20px;background:#f5a623;border:3px solid #fff;border-radius:50%;box-shadow:0 0 15px #f5a623;"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map);
    
    const circleColor = alertStatus === 'danger' ? '#ff3b3b' : alertStatus === 'caution' ? '#ffcc00' : '#00cc66';
    userCircle = L.circle([lat, lon], {
      radius: 50000,
      color: circleColor,
      fillColor: circleColor,
      fillOpacity: 0.1,
      weight: 2
    }).addTo(map);
  };

  const fetchWeatherData = async () => {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${userLat}&longitude=${userLon}` +
        `&current=temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,wind_direction_10m` +
        `&hourly=cape,lifted_index,convective_inhibition` +
        `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
      );
      const data = await response.json();
      setWeatherData(data);
    } catch (error) {
      console.error('Weather fetch error:', error);
    }
  };

  const fetchWarnings = async () => {
    try {
      const response = await fetch(
        `https://api.weather.gov/alerts/active?point=${userLat},${userLon}&status=actual`
      );
      const data = await response.json();
      
      let newStatus = 'safe';
      if (data.features) {
        data.features.forEach(alert => {
          const event = alert.properties.event.toLowerCase();
          if (event.includes('tornado')) newStatus = 'danger';
          else if (event.includes('severe') || event.includes('flood')) {
            if (newStatus !== 'danger') newStatus = 'caution';
          }
        });
        setWarnings(data.features);
      }
      setAlertStatus(newStatus);
      
      // Update map markers if initialized
      if (map && userMarker) {
        updateUserMarker(userLat, userLon);
      }
    } catch (error) {
      console.error('Warnings fetch error:', error);
    }
  };

  const getWindDirection = (degrees) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
  };

  const calculateLCL = (tempF, dewpointF) => {
    const spread = tempF - dewpointF;
    return spread * 227;
  };

  const getCurrentValues = () => {
    if (!weatherData.current) return {};
    const current = weatherData.current;
    const hourly = weatherData.hourly;
    const hourIndex = new Date().getHours();
    
    return {
      temp: Math.round(current.temperature_2m),
      dewpoint: Math.round(current.dew_point_2m),
      windSpeed: Math.round(current.wind_speed_10m),
      windDir: Math.round(current.wind_direction_10m),
      pressure: Math.round(current.surface_pressure),
      humidity: Math.round(current.relative_humidity_2m),
      cape: hourly?.cape ? Math.round(hourly.cape[hourIndex] || 0) : 0,
      li: hourly?.lifted_index ? (hourly.lifted_index[hourIndex] || 0).toFixed(1) : 0,
      cin: hourly?.convective_inhibition ? Math.abs(hourly.convective_inhibition[hourIndex]) || 0 : 0,
      lcl: calculateLCL(current.temperature_2m, current.dew_point_2m),
      lapseRate: (6.5 + (current.temperature_2m - current.dew_point_2m) / 20).toFixed(1)
    };
  };

  const getThreatLevel = (values) => {
    let score = 0;
    if (values.cape > 3000) score += 35;
    else if (values.cape > 2000) score += 25;
    else if (values.cape > 1000) score += 15;
    
    if (values.li < -6) score += 25;
    else if (values.li < -4) score += 15;
    
    if (values.cin > 100) score -= 10;
    if ((values.temp - values.dewpoint) < 10) score += 10;
    
    score = Math.max(0, Math.min(100, score));
    
    if (score >= 75) return { level: 'EXTREME', class: 'extreme' };
    if (score >= 50) return { level: 'HIGH', class: 'high' };
    if (score >= 25) return { level: 'MODERATE', class: 'moderate' };
    return { level: 'LOW', class: 'low' };
  };

  const handleMediaSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const item = {
      url: formData.get('url'),
      title: formData.get('title'),
      date: formData.get('date'),
      location: formData.get('location'),
      id: Date.now()
    };
    
    if (modalType === 'video') {
      const newVideos = [...videos, item];
      setVideos(newVideos);
      localStorage.setItem('skystorm_videos', JSON.stringify(newVideos));
    } else {
      const newPhotos = [...photos, item];
      setPhotos(newPhotos);
      localStorage.setItem('skystorm_photos', JSON.stringify(newPhotos));
    }
    setShowModal(false);
    e.target.reset();
  };

  const extractYouTubeId = (url) => {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'json'].includes(ext)) {
      alert('Please upload CSV or JSON');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let data;
        if (ext === 'json') {
          data = JSON.parse(e.target.result);
        } else {
          const lines = e.target.result.trim().split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const row = {};
            headers.forEach((h, i) => row[h] = values[i]);
            return row;
          });
        }
        setUploadedData(data);
        setUploadFileName(file.name);
      } catch (err) {
        alert('Error parsing file');
      }
    };
    reader.readAsText(file);
  };

  const values = getCurrentValues();
  const threat = getThreatLevel(values);

  return (
    <div className="skystorm-app">
      {/* Navigation */}
      <nav className="main-nav">
        <div className="nav-brand">
          <span className="brand-text">SKYSTORM<span className="brand-accent">DATA</span></span>
        </div>
        <div className="nav-links">
          {['home', 'radar', 'data', 'gallery', 'upload'].map(section => (
            <button
              key={section}
              className={`nav-link ${activeSection === section ? 'active' : ''}`}
              onClick={() => setActiveSection(section)}
            >
              <i className={`fas fa-${section === 'home' ? 'home' : section === 'radar' ? 'satellite-dish' : section === 'data' ? 'chart-line' : section === 'gallery' ? 'images' : 'upload'}`}></i>
              <span>{section.charAt(0).toUpperCase() + section.slice(1)}</span>
            </button>
          ))}
        </div>
        <div className="nav-status">
          <span className="status-indicator"><i className="fas fa-location-crosshairs"></i> {gpsStatus}</span>
          <span className={`status-indicator ${alertStatus}`}>
            <i className={`fas fa-${alertStatus === 'safe' ? 'shield' : 'exclamation-triangle'}`}></i>
            {alertStatus.toUpperCase()}
          </span>
        </div>
      </nav>

      {/* Home Section */}
      {activeSection === 'home' && (
        <section className="section">
          <div className="hero">
            <div className="hero-content">
              <div className="hero-badge">OHIO VALLEY STORMCHASING</div>
              <h1 className="hero-title">SKYSTORM <span className="highlight">DATA</span> LLC</h1>
              <p className="hero-subtitle">Real-Time Storm Tracking & Research Data Collection</p>
              <div className="hero-stats">
                <div className="stat">
                  <i className="fas fa-bolt"></i>
                  <span className="stat-value">150+</span>
                  <span className="stat-label">Storms Tracked</span>
                </div>
                <div className="stat">
                  <i className="fas fa-database"></i>
                  <span className="stat-value">Live</span>
                  <span className="stat-label">Data Feed</span>
                </div>
                <div className="stat">
                  <i className="fas fa-map-marked-alt"></i>
                  <span className="stat-value">Ohio Valley</span>
                  <span className="stat-label">Coverage</span>
                </div>
              </div>
            </div>
            <div className="hero-visual">
              <div className="radar-animation">
                <div className="radar-sweep"></div>
                <div className="radar-ring r1"></div>
                <div className="radar-ring r2"></div>
                <div className="radar-ring r3"></div>
                <div className="radar-center"></div>
              </div>
            </div>
          </div>

          <div className="about-section">
            <h2 className="section-title"><i className="fas fa-tornado"></i> What We Do</h2>
            <div className="about-grid">
              <div className="about-card">
                <div className="card-icon"><i className="fas fa-car"></i></div>
                <h3>Storm Intercept</h3>
                <p>We chase severe weather across the Ohio Valley, getting close to supercells, tornadoes, and severe thunderstorms to document and study them.</p>
              </div>
              <div className="about-card">
                <div className="card-icon"><i className="fas fa-chart-area"></i></div>
                <h3>Research Data</h3>
                <p>Every chase contributes valuable meteorological data — soundings, storm observations, and parameters that advance severe weather research.</p>
              </div>
              <div className="about-card">
                <div className="card-icon"><i className="fas fa-broadcast-tower"></i></div>
                <h3>Real-Time Reports</h3>
                <p>Ground-truth reports during active severe weather, helping meteorologists and emergency managers make critical decisions.</p>
              </div>
              <div className="about-card">
                <div className="card-icon"><i className="fas fa-video"></i></div>
                <h3>Documentation</h3>
                <p>High-quality video and photography of severe weather for research, education, and media — capturing nature's raw power.</p>
              </div>
            </div>
          </div>

          <div className="live-conditions">
            <h2 className="section-title"><i className="fas fa-thermometer-half"></i> Current Conditions</h2>
            <div className="conditions-grid">
              <div className="condition-card">
                <i className="fas fa-temperature-high"></i>
                <span className="condition-value">{values.temp || '--'}°F</span>
                <span className="condition-label">Temperature</span>
              </div>
              <div className="condition-card">
                <i className="fas fa-wind"></i>
                <span className="condition-value">{values.windSpeed || '--'} mph</span>
                <span className="condition-label">Wind</span>
              </div>
              <div className="condition-card">
                <i className="fas fa-tint"></i>
                <span className="condition-value">{values.dewpoint || '--'}°F</span>
                <span className="condition-label">Dew Point</span>
              </div>
              <div className="condition-card">
                <i className="fas fa-fire"></i>
                <span className="condition-value">{values.cape || '--'} J/kg</span>
                <span className="condition-label">CAPE</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Radar Section */}
      {activeSection === 'radar' && (
        <section className="section">
          <div className="radar-container">
            <div className="radar-header">
              <h2><i className="fas fa-satellite-dish"></i> Storm Radar</h2>
              <div className="radar-controls">
                <button className="control-btn" onClick={() => map?.setView([userLat, userLon], 10)}>
                  <i className="fas fa-crosshairs"></i> Center
                </button>
              </div>
            </div>
            <div id="map" ref={mapRef} style={{ width: '100%', height: 'calc(100vh - 250px)', borderRadius: '12px' }}></div>
            
            <div className="radar-legend">
              <h4>Warning Types</h4>
              <div className="legend-item"><span className="legend-color tornado"></span> Tornado</div>
              <div className="legend-item"><span className="legend-color severe"></span> Severe T-Storm</div>
              <div className="legend-item"><span className="legend-color flash-flood"></span> Flash Flood</div>
              <h4>Your Status</h4>
              <div className="legend-item"><span className="legend-color safe-zone"></span> Safe</div>
              <div className="legend-item"><span className="legend-color caution-zone"></span> Caution</div>
              <div className="legend-item"><span className="legend-color danger-zone"></span> Danger</div>
            </div>

            <div className="warnings-panel">
              <h3><i className="fas fa-bell"></i> Active Alerts</h3>
              {warnings.length === 0 ? (
                <p className="no-warnings">No active warnings in your area</p>
              ) : (
                warnings.map((alert, i) => (
                  <div key={i} className={`warning-item ${alert.properties.event.toLowerCase().includes('tornado') ? 'tornado' : 'severe'}`}>
                    <h4>{alert.properties.event}</h4>
                    <p>{alert.properties.areaDesc || 'Area not specified'}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* Data Section */}
      {activeSection === 'data' && (
        <section className="section">
          <div className="data-header">
            <h2><i className="fas fa-chart-line"></i> Atmospheric Data</h2>
            <span className="data-timestamp">Updated: {new Date().toLocaleTimeString()}</span>
          </div>
          
          <div className="data-dashboard">
            <div className="data-panel main-panel">
              <h3><i className="fas fa-wind"></i> Surface Observations</h3>
              <div className="data-grid">
                <div className="data-item">
                  <div className="data-icon"><i className="fas fa-temperature-high"></i></div>
                  <div className="data-info">
                    <span className="data-value">{values.temp || '--'}</span>
                    <span className="data-unit">°F</span>
                  </div>
                  <span className="data-label">Temperature</span>
                </div>
                <div className="data-item">
                  <div className="data-icon"><i className="fas fa-tint"></i></div>
                  <div className="data-info">
                    <span className="data-value">{values.dewpoint || '--'}</span>
                    <span className="data-unit">°F</span>
                  </div>
                  <span className="data-label">Dew Point</span>
                </div>
                <div className="data-item">
                  <div className="data-icon"><i className="fas fa-wind"></i></div>
                  <div className="data-info">
                    <span className="data-value">{values.windSpeed || '--'}</span>
                    <span className="data-unit">mph</span>
                  </div>
                  <span className="data-label">Wind Speed</span>
                </div>
                <div className="data-item">
                  <div className="data-icon"><i className="fas fa-compass"></i></div>
                  <div className="data-info">
                    <span className="data-value">{values.windDir || '--'}</span>
                    <span className="data-unit">° {getWindDirection(values.windDir || 0)}</span>
                  </div>
                  <span className="data-label">Wind Dir</span>
                </div>
                <div className="data-item">
                  <div className="data-icon"><i className="fas fa-gauge-high"></i></div>
                  <div className="data-info">
                    <span className="data-value">{values.pressure || '--'}</span>
                    <span className="data-unit">mb</span>
                  </div>
                  <span className="data-label">Pressure</span>
                </div>
                <div className="data-item">
                  <div className="data-icon"><i className="fas fa-droplet"></i></div>
                  <div className="data-info">
                    <span className="data-value">{values.humidity || '--'}</span>
                    <span className="data-unit">%</span>
                  </div>
                  <span className="data-label">Humidity</span>
                </div>
              </div>
            </div>

            <div className="data-panel sounding-panel">
              <h3><i className="fas fa-layer-group"></i> Sounding Parameters</h3>
              <div className="sounding-grid">
                <div className="sounding-item critical">
                  <div className="sounding-header">
                    <span className="sounding-label">CAPE</span>
                    <span className="sounding-desc">Convective Available Potential Energy</span>
                  </div>
                  <div className="sounding-value-container">
                    <span className="sounding-value">{values.cape || '--'}</span>
                    <span className="sounding-unit">J/kg</span>
                  </div>
                  <div className="sounding-bar">
                    <div className="sounding-fill" style={{ width: `${Math.min((values.cape || 0) / 50, 100)}%` }}></div>
                  </div>
                </div>
                <div className="sounding-item">
                  <div className="sounding-header">
                    <span className="sounding-label">LCL</span>
                    <span className="sounding-desc">Lifted Condensation Level</span>
                  </div>
                  <div className="sounding-value-container">
                    <span className="sounding-value">{Math.round(values.lcl) || '--'}</span>
                    <span className="sounding-unit">ft AGL</span>
                  </div>
                </div>
                <div className="sounding-item">
                  <div className="sounding-header">
                    <span className="sounding-label">Lapse Rate</span>
                    <span className="sounding-desc">700-500mb Temp Change</span>
                  </div>
                  <div className="sounding-value-container">
                    <span className="sounding-value">{values.lapseRate || '--'}</span>
                    <span className="sounding-unit">°C/km</span>
                  </div>
                </div>
                <div className="sounding-item">
                  <div className="sounding-header">
                    <span className="sounding-label">LI</span>
                    <span className="sounding-desc">Lifted Index</span>
                  </div>
                  <div className="sounding-value-container">
                    <span className="sounding-value">{values.li || '--'}</span>
                    <span className="sounding-unit">°C</span>
                  </div>
                </div>
                <div className="sounding-item">
                  <div className="sounding-header">
                    <span className="sounding-label">CIN</span>
                    <span className="sounding-desc">Convective Inhibition</span>
                  </div>
                  <div className="sounding-value-container">
                    <span className="sounding-value">{Math.round(values.cin) || '--'}</span>
                    <span className="sounding-unit">J/kg</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="data-panel threat-panel">
              <h3><i className="fas fa-exclamation-circle"></i> Threat Assessment</h3>
              <div className="threat-meter">
                <div className={`threat-level ${threat.class}`}>{threat.level}</div>
                <div className="threat-bar-container">
                  <div className="threat-bar" style={{ width: `${threat.level === 'LOW' ? 20 : threat.level === 'MODERATE' ? 45 : threat.level === 'HIGH' ? 70 : 95}%` }}></div>
                </div>
                <div className="threat-labels">
                  <span>LOW</span><span>MODERATE</span><span>HIGH</span><span>EXTREME</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Gallery Section */}
      {activeSection === 'gallery' && (
        <section className="section">
          <div className="gallery-header">
            <h2><i className="fas fa-images"></i> Storm Gallery</h2>
            <p>Documentation from the field — storms chased across the Ohio Valley</p>
          </div>

          <div className="gallery-tabs">
            <button className="gallery-tab active" onClick={(e) => {
              document.querySelectorAll('.gallery-tab').forEach(t => t.classList.remove('active'));
              e.target.classList.add('active');
              document.getElementById('videos-content').style.display = 'block';
              document.getElementById('photos-content').style.display = 'none';
            }}>Videos</button>
            <button className="gallery-tab" onClick={(e) => {
              document.querySelectorAll('.gallery-tab').forEach(t => t.classList.remove('active'));
              e.target.classList.add('active');
              document.getElementById('videos-content').style.display = 'none';
              document.getElementById('photos-content').style.display = 'block';
            }}>Photos</button>
          </div>

          <div id="videos-content" className="video-grid">
            {videos.map(video => (
              <div key={video.id} className="video-card">
                <div className="video-embed">
                  <iframe src={`https://www.youtube.com/embed/${extractYouTubeId(video.url)}`} frameBorder="0" allowFullScreen></iframe>
                </div>
                <div className="media-info">
                  <h4>{video.title}</h4>
                  <p>{video.location} {video.date && `• ${video.date}`}</p>
                </div>
              </div>
            ))}
            <div className="add-media-card" onClick={() => { setModalType('video'); setShowModal(true); }}>
              <i className="fas fa-plus"></i>
              <span>Add YouTube Video</span>
            </div>
          </div>

          <div id="photos-content" className="photo-grid" style={{ display: 'none' }}>
            {photos.map(photo => (
              <div key={photo.id} className="photo-card">
                <img src={photo.url} alt={photo.title} />
                <div className="media-info">
                  <h4>{photo.title}</h4>
                  <p>{photo.location} {photo.date && `• ${photo.date}`}</p>
                </div>
              </div>
            ))}
            <div className="add-media-card" onClick={() => { setModalType('photo'); setShowModal(true); }}>
              <i className="fas fa-plus"></i>
              <span>Add Photo URL</span>
            </div>
          </div>
        </section>
      )}

      {/* Upload Section */}
      {activeSection === 'upload' && (
        <section className="section">
          <div className="upload-header">
            <h2><i className="fas fa-upload"></i> Data Upload</h2>
            <p>Upload chase data in CSV or JSON format</p>
          </div>

          <div className="upload-container">
            {!uploadedData ? (
              <label className="upload-zone">
                <i className="fas fa-cloud-upload-alt"></i>
                <h3>Drop your data file here</h3>
                <p>or click to browse</p>
                <span className="upload-formats">Accepts: CSV, JSON</span>
                <input type="file" accept=".csv,.json" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            ) : (
              <div className="upload-preview">
                <div className="preview-header">
                  <h3><i className="fas fa-file-alt"></i> {uploadFileName}</h3>
                  <button className="clear-btn" onClick={() => { setUploadedData(null); setUploadFileName(''); }}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="preview-content">
                  {Array.isArray(uploadedData) && uploadedData.length > 0 && (
                    <table className="preview-table">
                      <thead>
                        <tr>{Object.keys(uploadedData[0]).map(h => <th key={h}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {uploadedData.slice(0, 10).map((row, i) => (
                          <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{v}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p style={{ marginTop: '1rem', color: '#606070', fontSize: '0.85rem' }}>
                    Showing {Math.min(10, uploadedData?.length || 0)} of {uploadedData?.length || 0} rows
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal active" onClick={(e) => e.target.className.includes('modal') && setShowModal(false)}>
          <div className="modal-content">
            <span className="modal-close" onClick={() => setShowModal(false)}>&times;</span>
            <h3>{modalType === 'video' ? 'Add YouTube Video' : 'Add Photo'}</h3>
            <form onSubmit={handleMediaSubmit}>
              <div className="form-group">
                <label>URL</label>
                <input type="url" name="url" placeholder={modalType === 'video' ? 'YouTube URL' : 'Image URL'} required />
              </div>
              <div className="form-group">
                <label>Title</label>
                <input type="text" name="title" placeholder="Storm description" required />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" name="date" required />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input type="text" name="location" placeholder="City, State" />
              </div>
              <button type="submit" className="submit-btn">Add to Gallery</button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="main-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="brand-text">SKYSTORM<span className="brand-accent">DATA</span></span>
            <p>Ohio Valley Storm Chasing</p>
          </div>
          <div className="footer-links">
            <a href="https://www.spc.noaa.gov/" target="_blank" rel="noreferrer">SPC</a>
            <a href="https://www.weather.gov/" target="_blank" rel="noreferrer">NWS</a>
            <a href="https://radar.weather.gov/" target="_blank" rel="noreferrer">Radar</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2024 SkyStorm Data LLC. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
