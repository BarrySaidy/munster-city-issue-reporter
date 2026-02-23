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
  })
  .catch(function (err) {
    console.error(err);
    alert("Could not load WFS data. Open DevTools (F12) → Console for details.");
  });