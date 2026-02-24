# CityFix - Street Issue Reporter

> Spatial Information Infrastructure (SII) Demo

## Overview

CityFix is a Spatial Information Infrastructure demonstration for crowd-reported street issues in Münster. It enables urban maintenance teams to visualize, filter, and report infrastructure problems through an interactive web map.

This project integrates:
- An external OGC WMS service (Münster city boundary)
- A self-published WFS service (issue reports via GeoServer)
- WFS-T transactional support (submit new issues that persist to the database)
- A Leaflet client consuming both services with interactive features

## Key Features

- ✅ Color-coded markers by severity (green/orange/red)
- ✅ Filter controls by category and status
- ✅ Interactive issue reporting form with WFS-T persistence
- ✅ Styled legend and UI controls
- ✅ Toggle external WMS layer visibility

---

## Requirements

- Java 17 (Temurin recommended)
- GeoServer 2.28.x
- Python 3 (for local HTTP server)
- Modern web browser (Chrome, Firefox, Safari)

---

## How to Run the Project

### Step 1: Start GeoServer

**On macOS (Homebrew installation):**
```bash
geoserver start
```

**On Windows/Linux:**
Navigate to `geoserver/bin/startup.bat` (or `startup.sh`)

Verify at: http://localhost:8080/geoserver

### Step 2: Publish the Dataset (First Time Setup)

1. **Login to GeoServer** (username: `admin` / password: `geoserver`)

2. **Create workspace:**
   - Data → Workspaces → Add new workspace
   - Name: `cityfix`
   - Namespace URI: `http://cityfix` (or any URI you prefer)
   - Check "Enabled"
   - Save

3. **Add Store:**
   - Data → Stores → Add new Store
   - Type: Shapefile
   - Workspace: `cityfix`
   - Data Source Name: `Munster-Issues`
   - Browse to: `CityFix/data/Munster-Issues.shp`
   - Save

4. **Publish Layer:**
   - Click "Publish" next to Munster-Issues
   - CRS: `EPSG:4326`
   - Click "Compute from data" and "Compute from native bounds"
   - Save

5. **Enable CORS** (if not already enabled):
   - Edit: `[geoserver-path]/webapps/geoserver/WEB-INF/web.xml`
   - Find CORS section and set to `true`
   - Restart GeoServer

**Test WFS:**
```
http://localhost:8080/geoserver/cityfix/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=cityfix:Munster-Issues&outputFormat=application/json
```

### Step 3: Start the Local Web Server

Navigate to the CityFix folder and run:

```bash
cd /path/to/CityFix
python3 -m http.server 8000
```

### Step 4: Open the Application

Open your browser and go to:

```
http://localhost:8000
```

---

## What Should Appear

The web application displays:

### 1. Map Layers
- OpenStreetMap basemap
- Münster city boundary (external WMS - toggleable in layer control)
- Issue report points (served via GeoServer WFS)

### 2. Markers (Color-coded by severity)
| Color | Severity |
|-------|----------|
| 🟢 Green | Minor issues (1) |
| 🟠 Orange | Moderate issues (2-3) |
| 🔴 Red | Severe issues (4-5) |

Click any marker to see popup with all issue details.

### 3. Filter Panel (top-right, purple gradient)
- Filter by Category: Broken Light, Roadwork, Blockage
- Filter by Status: Open, In Progress, Resolved
- Uncheck boxes to hide markers matching those criteria

### 4. Legend (bottom-right, dark gradient)
- Shows severity color scale

### 5. Report Issue (top-left, green button)
- Click "Report Issue" button
- Form panel appears on the left
- Click anywhere on the map to set location (green pin appears)
- Select category, severity, enter description
- Click Submit - issue is saved to GeoServer via WFS-T
- New marker appears immediately and persists after refresh

---

## Project Structure

```
CityFix/
├── index.html                  # Main HTML file
├── script.js                   # JavaScript (Leaflet, WFS, WFS-T, filters, UI)
├── style.css                   # Map styling
├── README.md                   # This file
├── CityFix_Summary_Report.md   # 750-word project summary
└── data/
    ├── Münster-Issues.shp      # Shapefile (geometry)
    ├── Münster-Issues.dbf      # Shapefile (attributes)
    ├── Münster-Issues.shx      # Shapefile (index)
    ├── Münster-Issues.prj      # Shapefile (projection)
    └── Münster-Issues.cpg      # Shapefile (encoding)
```

---

## Data Model

**Issue Reports (Point Features):**

| Attribute | Description |
|-----------|-------------|
| `id` | Unique identifier (string) |
| `category` | Issue type: `broken_light` \| `roadwork` \| `blockage` |
| `status` | Current state: `open` \| `in_progress` \| `resolved` |
| `severity` | Priority level (1-5) |
| `descriptio` | Description text (truncated to 10 chars for Shapefile) |
| `timestamp` | ISO datetime string |

---

## Technologies Used

- **Leaflet.js** - Web mapping library
- **GeoServer** - OGC WMS/WFS server
- **WFS-T** - Transactional WFS for data submission
- **OpenStreetMap** - Basemap tiles
- **Stadt Münster WMS** - External official boundary layer

---

## Important Notes

1. GeoServer must be running before opening the web application
2. Use a local HTTP server (`python3 -m http.server`) - do not open `index.html` directly
3. CORS must be enabled in GeoServer for browser requests to work
4. The Shapefile format limits attribute names to 10 characters
5. New issues submitted via the form are persisted to the Shapefile

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Could not load WFS data" error | Ensure GeoServer is running at http://localhost:8080 |
| CORS error in browser console | 1. Use `python3 -m http.server` (not `file://`) <br> 2. Enable CORS in GeoServer's `web.xml` |
| WFS-T submission fails | Check GeoServer namespace matches the auto-detected namespace in console |
| Map is blank | Check browser console (F12) for JavaScript errors |
