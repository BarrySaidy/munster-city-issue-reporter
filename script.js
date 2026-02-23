// ===============================
// CityFix Münster - Leaflet Client
// Loads:
// 1) OSM basemap
// 2) Münster WMS (external)
// 3) Issues from GeoServer WFS (local)
// ===============================

// 1) Create map
var map = L.map("map").setView([51.962, 7.625], 12);

// Store all markers for filtering
var allMarkers = [];
var issuesLayer;

// Active filters
var activeFilters = {
  categories: ["broken_light", "roadwork", "blockage"],
  statuses: ["open", "in_progress", "resolved"]
};

// Reporting mode state
var isReportingMode = false;
var reportingLatLng = null;
var tempMarker = null;

// WFS-T configuration
var wfsTransactionUrl = "http://localhost:8080/geoserver/cityfix/wfs";
var featureTypeName = "Münster-Issues";
var workspaceName = "cityfix";

// Will be set dynamically from GeoServer
var featureNS = null;

// Fetch the correct namespace from GeoServer
function fetchNamespace(callback) {
  if (featureNS) {
    callback(featureNS);
    return;
  }
  
  fetch("http://localhost:8080/geoserver/cityfix/wfs?service=WFS&version=1.1.0&request=DescribeFeatureType&typeName=cityfix:Münster-Issues")
    .then(function(res) { return res.text(); })
    .then(function(xml) {
      // Extract namespace from targetNamespace attribute
      var match = xml.match(/targetNamespace="([^"]+)"/);
      if (match) {
        featureNS = match[1];
        console.log("Detected namespace:", featureNS);
        callback(featureNS);
      } else {
        // Fallback - try common patterns
        featureNS = "http://cityfix";
        callback(featureNS);
      }
    })
    .catch(function(err) {
      console.error("Could not fetch namespace:", err);
      featureNS = "http://cityfix";
      callback(featureNS);
    });
}

// Generate unique ID
function generateId() {
  return 'issue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// WFS-T Insert Transaction
function insertFeatureWFST(feature, callback) {
  fetchNamespace(function(ns) {
    var id = feature.id;
    var category = feature.category;
    var status = feature.status;
    var severity = feature.severity;
    var description = feature.description;
    var timestamp = feature.timestamp;
    var lon = feature.lon;
    var lat = feature.lat;
    
    // Build WFS-T Insert XML with correct namespace
    var xml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<wfs:Transaction service="WFS" version="1.1.0" ' +
      'xmlns:wfs="http://www.opengis.net/wfs" ' +
      'xmlns:cityfix="' + ns + '" ' +
      'xmlns:gml="http://www.opengis.net/gml" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<wfs:Insert>' +
      '<cityfix:Münster-Issues>' +
      '<cityfix:id>' + id + '</cityfix:id>' +
      '<cityfix:category>' + category + '</cityfix:category>' +
      '<cityfix:status>' + status + '</cityfix:status>' +
      '<cityfix:severity>' + severity + '</cityfix:severity>' +
      '<cityfix:descriptio>' + description.substring(0, 254) + '</cityfix:descriptio>' +
      '<cityfix:timestamp>' + timestamp + '</cityfix:timestamp>' +
      '<cityfix:the_geom>' +
      '<gml:Point srsName="EPSG:4326">' +
      '<gml:coordinates>' + lon + ',' + lat + '</gml:coordinates>' +
      '</gml:Point>' +
      '</cityfix:the_geom>' +
      '</cityfix:Münster-Issues>' +
      '</wfs:Insert>' +
      '</wfs:Transaction>';
    
    console.log("WFS-T Request XML:", xml);
    
    fetch(wfsTransactionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml'
      },
      body: xml
    })
    .then(function(response) {
      return response.text();
    })
    .then(function(responseText) {
      console.log('WFS-T Response:', responseText);
      if (responseText.includes('totalInserted="1"') || responseText.includes('wfs:totalInserted>1<') || responseText.includes('TransactionResponse')) {
        callback(true, 'Issue reported successfully!');
      } else if (responseText.includes('Exception') || responseText.includes('error')) {
        callback(false, 'Server error: Check console for details');
      } else {
        // Might still be success
        callback(true, 'Issue submitted to server.');
      }
    })
    .catch(function(error) {
      console.error('WFS-T Error:', error);
      callback(false, 'Network error: ' + error.message);
    });
  });
}

// 2) OSM basemap
var osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// 3) Münster official WMS (external service)
var muensterWMS = L.tileLayer.wms(
  "https://www.stadt-muenster.de/ows/mapserv706/odalkisserv?",
  {
    layers: "stadtgebiet",
    format: "image/png",
    transparent: true,
    version: "1.1.1",
  }
).addTo(map);

// Layer control (so you can prove WMS is external and toggle it)
L.control
  .layers(
    { OSM: osm },
    { "Münster Stadtgebiet (WMS)": muensterWMS }
  )
  .addTo(map);

// Helper function to get color based on severity
function getSeverityColor(severity) {
  if (severity >= 4) return "#d32f2f"; // Red for severe (4-5)
  if (severity >= 2) return "#f57c00"; // Orange/Yellow for moderate (2-3)
  return "#388e3c"; // Green for minor (1)
}

// Filter function - show/hide markers based on active filters
function applyFilters() {
  allMarkers.forEach(function(item) {
    var category = item.properties.category || "";
    var status = item.properties.status || "";
    
    var categoryMatch = activeFilters.categories.includes(category);
    var statusMatch = activeFilters.statuses.includes(status);
    
    if (categoryMatch && statusMatch) {
      if (!map.hasLayer(item.marker)) {
        map.addLayer(item.marker);
      }
    } else {
      if (map.hasLayer(item.marker)) {
        map.removeLayer(item.marker);
      }
    }
  });
}

// Toggle filter when checkbox changes
function toggleFilter(type, value, checked) {
  if (type === "category") {
    if (checked) {
      if (!activeFilters.categories.includes(value)) {
        activeFilters.categories.push(value);
      }
    } else {
      activeFilters.categories = activeFilters.categories.filter(function(c) { return c !== value; });
    }
  } else if (type === "status") {
    if (checked) {
      if (!activeFilters.statuses.includes(value)) {
        activeFilters.statuses.push(value);
      }
    } else {
      activeFilters.statuses = activeFilters.statuses.filter(function(s) { return s !== value; });
    }
  }
  applyFilters();
}

// 4) WFS URL (your GeoServer layer)
var wfsUrl =
  "http://localhost:8080/geoserver/cityfix/wfs" +
  "?service=WFS" +
  "&version=1.0.0" +
  "&request=GetFeature" +
  "&typeName=cityfix:M%C3%BCnster-Issues" +
  "&outputFormat=application/json";

// 5) Load issues from WFS and display as obvious markers + popups
fetch(wfsUrl)
  .then(function (res) {
    if (!res.ok) throw new Error("WFS request failed: " + res.status);
    return res.json();
  })
  .then(function (data) {
    console.log("Loaded WFS features:", data.features ? data.features.length : 0);

    // Create markers and store for filtering
    data.features.forEach(function(feature) {
      var coords = feature.geometry.coordinates;
      var latlng = L.latLng(coords[1], coords[0]);
      var p = feature.properties || {};
      
      var severity = p.severity || 1;
      var color = getSeverityColor(severity);
      
      var marker = L.circleMarker(latlng, {
        radius: 10,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
        color: "#333",
        fillColor: color,
      });
      
      // Build popup
      var id = p.id ?? "—";
      var category = p.category ?? "—";
      var status = p.status ?? "—";
      var description = p.descriptio ?? "—";
      var timestamp = p.timestamp ?? "—";

      var html =
        '<div style="min-width:220px">' +
        "<h3 style='margin:0 0 6px 0;'>" + category + "</h3>" +
        "<div><b>ID:</b> " + id + "</div>" +
        "<div><b>Status:</b> " + status + "</div>" +
        "<div><b>Severity:</b> " + severity + "</div>" +
        "<div><b>Description:</b> " + description + "</div>" +
        "<div><b>Time:</b> " + timestamp + "</div>" +
        "</div>";

      marker.bindPopup(html);
      marker.addTo(map);
      
      // Store marker with properties for filtering
      allMarkers.push({
        marker: marker,
        properties: p
      });
    });

    // Zoom to all markers
    if (allMarkers.length > 0) {
      var group = L.featureGroup(allMarkers.map(function(m) { return m.marker; }));
      map.fitBounds(group.getBounds().pad(0.2));
    }

    // Add legend showing severity color scale
    var legend = L.control({ position: "bottomright" });
    legend.onAdd = function () {
      var div = L.DomUtil.create("div", "legend");
      
      var html = '<div style="background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding:20px; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.5); font-family:Arial, sans-serif; min-width:160px;">' +
        '<h2 style="margin:0 0 16px 0; font-size:16px; font-weight:bold; color:white; text-transform:uppercase; letter-spacing:1px; text-align:center; text-shadow:1px 1px 2px rgba(0,0,0,0.3);">Severity</h2>' +
        '<div style="background:rgba(255,255,255,0.95); padding:14px; border-radius:8px;">' +
          '<div style="display:flex; align-items:center; margin-bottom:10px; padding:8px 10px; background:#e8f5e9; border-radius:6px; border-left:4px solid #388e3c;">' +
            '<span style="width:22px; height:22px; background:#388e3c; border-radius:50%; margin-right:12px; border:2px solid #2e7d32; box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>' +
            '<span style="font-weight:600; color:#2e7d32;">Minor (1)</span>' +
          '</div>' +
          '<div style="display:flex; align-items:center; margin-bottom:10px; padding:8px 10px; background:#fff3e0; border-radius:6px; border-left:4px solid #f57c00;">' +
            '<span style="width:22px; height:22px; background:#f57c00; border-radius:50%; margin-right:12px; border:2px solid #e65100; box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>' +
            '<span style="font-weight:600; color:#e65100;">Moderate (2-3)</span>' +
          '</div>' +
          '<div style="display:flex; align-items:center; padding:8px 10px; background:#ffebee; border-radius:6px; border-left:4px solid #d32f2f;">' +
            '<span style="width:22px; height:22px; background:#d32f2f; border-radius:50%; margin-right:12px; border:2px solid #b71c1c; box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>' +
            '<span style="font-weight:600; color:#c62828;">Severe (4-5)</span>' +
          '</div>' +
        '</div>' +
      '</div>';
      
      div.innerHTML = html;
      return div;
    };
    legend.addTo(map);

    // Add filter control panel
    var filterControl = L.control({ position: "topright" });
    filterControl.onAdd = function () {
      var div = L.DomUtil.create("div", "filter-control");
      
      var html = '<div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding:20px; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.5); font-family:Arial, sans-serif; min-width:200px;">' +
        '<h2 style="margin:0 0 16px 0; font-size:18px; font-weight:bold; color:white; text-transform:uppercase; letter-spacing:1px; text-align:center; text-shadow:1px 1px 2px rgba(0,0,0,0.3);">Filters</h2>' +
        '<div style="background:rgba(255,255,255,0.95); padding:14px; border-radius:8px; margin-bottom:12px;">' +
          '<h3 style="margin:0 0 10px 0; font-size:13px; font-weight:bold; color:#555; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #667eea; padding-bottom:6px;">Category</h3>' +
          '<label style="display:flex; align-items:center; margin-bottom:8px; cursor:pointer; font-size:14px; padding:6px 8px; background:#f5f5f5; border-radius:6px;"><input type="checkbox" id="filter-broken_light" checked style="margin-right:10px; width:18px; height:18px; cursor:pointer; accent-color:#667eea;"><span style="font-weight:500;">💡 Broken Light</span></label>' +
          '<label style="display:flex; align-items:center; margin-bottom:8px; cursor:pointer; font-size:14px; padding:6px 8px; background:#f5f5f5; border-radius:6px;"><input type="checkbox" id="filter-roadwork" checked style="margin-right:10px; width:18px; height:18px; cursor:pointer; accent-color:#667eea;"><span style="font-weight:500;">🚧 Roadwork</span></label>' +
          '<label style="display:flex; align-items:center; cursor:pointer; font-size:14px; padding:6px 8px; background:#f5f5f5; border-radius:6px;"><input type="checkbox" id="filter-blockage" checked style="margin-right:10px; width:18px; height:18px; cursor:pointer; accent-color:#667eea;"><span style="font-weight:500;">⛔ Blockage</span></label>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,0.95); padding:14px; border-radius:8px;">' +
          '<h3 style="margin:0 0 10px 0; font-size:13px; font-weight:bold; color:#555; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #764ba2; padding-bottom:6px;">Status</h3>' +
          '<label style="display:flex; align-items:center; margin-bottom:8px; cursor:pointer; font-size:14px; padding:6px 8px; background:#ffebee; border-radius:6px; border-left:4px solid #d32f2f;"><input type="checkbox" id="filter-open" checked style="margin-right:10px; width:18px; height:18px; cursor:pointer; accent-color:#d32f2f;"><span style="color:#c62828; font-weight:600;">Open</span></label>' +
          '<label style="display:flex; align-items:center; margin-bottom:8px; cursor:pointer; font-size:14px; padding:6px 8px; background:#fff3e0; border-radius:6px; border-left:4px solid #f57c00;"><input type="checkbox" id="filter-in_progress" checked style="margin-right:10px; width:18px; height:18px; cursor:pointer; accent-color:#f57c00;"><span style="color:#e65100; font-weight:600;">In Progress</span></label>' +
          '<label style="display:flex; align-items:center; cursor:pointer; font-size:14px; padding:6px 8px; background:#e8f5e9; border-radius:6px; border-left:4px solid #388e3c;"><input type="checkbox" id="filter-resolved" checked style="margin-right:10px; width:18px; height:18px; cursor:pointer; accent-color:#388e3c;"><span style="color:#2e7d32; font-weight:600;">Resolved</span></label>' +
        '</div>' +
      '</div>';
      
      div.innerHTML = html;
      
      // Prevent map interactions when clicking on the control
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      
      return div;
    };
    filterControl.addTo(map);

    // Add event listeners for filter checkboxes
    document.getElementById("filter-broken_light").addEventListener("change", function(e) {
      toggleFilter("category", "broken_light", e.target.checked);
    });
    document.getElementById("filter-roadwork").addEventListener("change", function(e) {
      toggleFilter("category", "roadwork", e.target.checked);
    });
    document.getElementById("filter-blockage").addEventListener("change", function(e) {
      toggleFilter("category", "blockage", e.target.checked);
    });
    document.getElementById("filter-open").addEventListener("change", function(e) {
      toggleFilter("status", "open", e.target.checked);
    });
    document.getElementById("filter-in_progress").addEventListener("change", function(e) {
      toggleFilter("status", "in_progress", e.target.checked);
    });
    document.getElementById("filter-resolved").addEventListener("change", function(e) {
      toggleFilter("status", "resolved", e.target.checked);
    });

    // ========================================
    // REPORT ISSUE FEATURE
    // ========================================

    // Add Report Issue button control
    var reportControl = L.control({ position: "topleft" });
    reportControl.onAdd = function () {
      var div = L.DomUtil.create("div", "report-control");
      div.innerHTML = '<button id="report-btn" style="background:linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color:white; border:none; padding:14px 20px; border-radius:10px; font-size:16px; font-weight:bold; cursor:pointer; box-shadow:0 4px 15px rgba(0,0,0,0.3); text-transform:uppercase; letter-spacing:1px; display:flex; align-items:center; gap:8px;">' +
        '<span style="font-size:20px;">📍</span> Report Issue</button>';
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    reportControl.addTo(map);

    // Create side panel for issue form (doesn't block map clicks)
    var modalHtml = '<div id="report-modal" style="display:none; position:fixed; top:80px; left:60px; z-index:1500; pointer-events:auto;">' +
      '<div style="background:white; padding:24px; border-radius:16px; width:320px; box-shadow:0 10px 40px rgba(0,0,0,0.4); font-family:Arial, sans-serif; border:3px solid #11998e;">' +
        '<h2 style="margin:0 0 16px 0; color:#333; text-align:center; font-size:20px;">📍 Report New Issue</h2>' +
        '<div id="location-status" style="background:#fff3e0; padding:10px; border-radius:8px; margin-bottom:14px; text-align:center; color:#e65100; font-weight:500; font-size:13px;">👆 Click on the map to set location</div>' +
        
        '<label style="display:block; margin-bottom:4px; font-weight:600; color:#555; font-size:13px;">Category</label>' +
        '<select id="report-category" style="width:100%; padding:10px; border:2px solid #ddd; border-radius:8px; font-size:14px; margin-bottom:12px; cursor:pointer; box-sizing:border-box;">' +
          '<option value="broken_light">💡 Broken Light</option>' +
          '<option value="roadwork">🚧 Roadwork</option>' +
          '<option value="blockage">⛔ Blockage</option>' +
        '</select>' +
        
        '<label style="display:block; margin-bottom:4px; font-weight:600; color:#555; font-size:13px;">Severity: <span id="severity-value">3</span></label>' +
        '<input type="range" id="report-severity" min="1" max="5" value="3" style="width:100%; margin-bottom:12px; cursor:pointer;">' +
        '<div style="display:flex; justify-content:space-between; margin-top:-8px; margin-bottom:12px; font-size:11px; color:#888;"><span>Minor</span><span>Severe</span></div>' +
        
        '<label style="display:block; margin-bottom:4px; font-weight:600; color:#555; font-size:13px;">Description</label>' +
        '<textarea id="report-description" rows="2" placeholder="Describe the issue..." style="width:100%; padding:10px; border:2px solid #ddd; border-radius:8px; font-size:14px; margin-bottom:16px; resize:none; box-sizing:border-box;"></textarea>' +
        
        '<div style="display:flex; gap:10px;">' +
          '<button id="cancel-report" style="flex:1; padding:12px; background:#e0e0e0; border:none; border-radius:8px; font-size:14px; font-weight:bold; cursor:pointer; color:#555;">Cancel</button>' +
          '<button id="submit-report" style="flex:1; padding:12px; background:linear-gradient(135deg, #11998e 0%, #38ef7d 100%); border:none; border-radius:8px; font-size:14px; font-weight:bold; cursor:pointer; color:white;" disabled>Submit</button>' +
        '</div>' +
      '</div>' +
    '</div>';
    
    // Add modal to body
    var modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);

    // Get modal elements
    var modal = document.getElementById('report-modal');
    var reportBtn = document.getElementById('report-btn');
    var cancelBtn = document.getElementById('cancel-report');
    var submitBtn = document.getElementById('submit-report');
    var locationStatus = document.getElementById('location-status');
    var severitySlider = document.getElementById('report-severity');
    var severityValue = document.getElementById('severity-value');

    // Update severity display
    severitySlider.addEventListener('input', function() {
      severityValue.textContent = this.value;
    });

    // Open modal and enable reporting mode
    reportBtn.addEventListener('click', function() {
      isReportingMode = true;
      reportingLatLng = null;
      modal.style.display = 'block';
      reportBtn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
      reportBtn.innerHTML = '<span style="font-size:20px;">🎯</span> Click Map...';
      locationStatus.style.background = '#fff3e0';
      locationStatus.style.color = '#e65100';
      locationStatus.textContent = '👆 Click on the map to set location';
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.5';
    });

    // Cancel reporting
    cancelBtn.addEventListener('click', function() {
      closeReportModal();
    });

    function closeReportModal() {
      isReportingMode = false;
      reportingLatLng = null;
      modal.style.display = 'none';
      reportBtn.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
      reportBtn.innerHTML = '<span style="font-size:20px;">📍</span> Report Issue';
      
      // Remove temp marker if exists
      if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
      }
      
      // Reset form
      document.getElementById('report-category').value = 'broken_light';
      document.getElementById('report-severity').value = '3';
      document.getElementById('severity-value').textContent = '3';
      document.getElementById('report-description').value = '';
    }

    // Map click handler for setting location
    map.on('click', function(e) {
      if (!isReportingMode) return;
      
      reportingLatLng = e.latlng;
      
      // Remove previous temp marker
      if (tempMarker) {
        map.removeLayer(tempMarker);
      }
      
      // Add temp marker
      tempMarker = L.marker(e.latlng, {
        icon: L.divIcon({
          className: 'temp-marker',
          html: '<div style="background:#11998e; width:30px; height:30px; border-radius:50%; border:4px solid white; box-shadow:0 2px 10px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; font-size:16px;">📍</div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).addTo(map);
      
      // Update location status
      locationStatus.style.background = '#e8f5e9';
      locationStatus.style.color = '#2e7d32';
      locationStatus.textContent = '✓ Location set: ' + e.latlng.lat.toFixed(5) + ', ' + e.latlng.lng.toFixed(5);
      
      // Enable submit button
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
    });

    // Submit issue
    submitBtn.addEventListener('click', function() {
      if (!reportingLatLng) {
        alert('Please click on the map to set a location first.');
        return;
      }
      
      var category = document.getElementById('report-category').value;
      var severity = parseInt(document.getElementById('report-severity').value);
      var description = document.getElementById('report-description').value || 'No description';
      
      var newFeature = {
        id: generateId(),
        category: category,
        status: 'open',
        severity: severity,
        description: description,
        timestamp: new Date().toISOString().slice(0, 19),
        lat: reportingLatLng.lat,
        lon: reportingLatLng.lng
      };
      
      // Show loading state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      
      // Send to GeoServer via WFS-T
      insertFeatureWFST(newFeature, function(success, message) {
        if (success) {
          // Remove temp marker
          if (tempMarker) {
            map.removeLayer(tempMarker);
            tempMarker = null;
          }
          
          // Add permanent marker
          var color = getSeverityColor(severity);
          var marker = L.circleMarker(reportingLatLng, {
            radius: 10,
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85,
            color: "#333",
            fillColor: color,
          });
          
          var popupHtml = '<div style="min-width:220px">' +
            "<h3 style='margin:0 0 6px 0;'>" + category + "</h3>" +
            "<div><b>ID:</b> " + newFeature.id + "</div>" +
            "<div><b>Status:</b> open</div>" +
            "<div><b>Severity:</b> " + severity + "</div>" +
            "<div><b>Description:</b> " + description + "</div>" +
            "<div><b>Time:</b> " + newFeature.timestamp + "</div>" +
            "<div style='margin-top:8px; padding-top:8px; border-top:1px solid #ddd; color:#11998e; font-weight:bold;'>✓ Just reported!</div>" +
            "</div>";
          
          marker.bindPopup(popupHtml);
          marker.addTo(map);
          
          // Add to allMarkers for filtering
          allMarkers.push({
            marker: marker,
            properties: {
              id: newFeature.id,
              category: category,
              status: 'open',
              severity: severity,
              descriptio: description,
              timestamp: newFeature.timestamp
            }
          });
          
          alert('✓ ' + message);
          closeReportModal();
        } else {
          alert('Error: ' + message);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit';
        }
      });
    });
  })
  .catch(function (err) {
    console.error(err);
    alert("Could not load WFS data. Open DevTools (F12) → Console for details.");
  });