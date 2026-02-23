// ===============================
// CityFix Münster - Leaflet Client
// Loads:
// 1) OSM basemap
// 2) Münster WMS (external)
// 3) Issues from GeoServer WFS (local)
// ===============================

// 1) Create map
var map = L.map("map").setView([51.962, 7.625], 12);

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

    var issuesLayer = L.geoJSON(data, {
      // Color-code by severity
      pointToLayer: function (feature, latlng) {
        var severity = feature.properties.severity || 1;
        var color = getSeverityColor(severity);
        
        return L.circleMarker(latlng, {
          radius: 10,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
          color: "#333",
          fillColor: color,
        });
      },

      // Popups from your attributes
      onEachFeature: function (feature, layer) {
        console.log("Props keys:", Object.keys(feature.properties || {}), feature.properties);
        var p = feature.properties || {};

        var id = p.id ?? "—";
        var category = p.category ?? "—";
        var status = p.status ?? "—";
        var severity = p.severity ?? "—";
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

        layer.bindPopup(html);
      },
    }).addTo(map);

    // Zoom to issues (helps demo)
    var b = issuesLayer.getBounds();
    if (b.isValid()) map.fitBounds(b.pad(0.2));

    // Add legend showing severity color scale
    var legend = L.control({ position: "bottomright" });
    legend.onAdd = function () {
      var div = L.DomUtil.create("div", "legend");
      div.innerHTML = "<div style='background:white; padding:16px 18px; border-radius:8px; box-shadow:0 2px 12px rgba(0,0,0,0.4); border:2px solid #333; font-family:Arial, sans-serif;'>";
      div.innerHTML += "<h3 style='margin:0 0 12px 0; font-size:16px; font-weight:bold; color:#333; text-transform:uppercase; letter-spacing:0.5px;'>Issue Severity</h3>";
      div.innerHTML += "<div style='display:flex; align-items:center; margin-bottom:10px; font-size:14px;'><span style='width:20px; height:20px; background:#388e3c; border-radius:50%; margin-right:10px; border:2px solid #2e7d32;'></span><span style='font-weight:500;'>Minor (1)</span></div>";
      div.innerHTML += "<div style='display:flex; align-items:center; margin-bottom:10px; font-size:14px;'><span style='width:20px; height:20px; background:#f57c00; border-radius:50%; margin-right:10px; border:2px solid #e65100;'></span><span style='font-weight:500;'>Moderate (2-3)</span></div>";
      div.innerHTML += "<div style='display:flex; align-items:center; font-size:14px;'><span style='width:20px; height:20px; background:#d32f2f; border-radius:50%; margin-right:10px; border:2px solid #b71c1c;'></span><span style='font-weight:500;'>Severe (4-5)</span></div>";
      div.innerHTML += "</div>";
      return div;
    };
    legend.addTo(map);
  })
  .catch(function (err) {
    console.error(err);
    alert("Could not load WFS data. Open DevTools (F12) → Console for details.");
  });