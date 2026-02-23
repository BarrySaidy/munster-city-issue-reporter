# CityFix: A Spatial Information Infrastructure for Crowd-Reported Street Issues

## Project Summary Report

**Course:** Spatial Information Infrastructure  
**Date:** February 2026  

---

## 1. Introduction and Use Case

CityFix addresses a common urban challenge: scattered and unorganized reports of street infrastructure problems. Currently, municipalities receive issue reports through disparate channels—phone calls, emails, and paper forms—making it difficult to identify patterns or prioritize maintenance efforts. Our project demonstrates how a Spatial Information Infrastructure (SII) can solve this problem by combining official spatial data with user-generated reports in a unified web mapping application.

The guiding research question for this project was: *"Where are street issues currently reported, and which issue types dominate in different areas?"* By visualizing reports spatially, maintenance teams can identify hotspots, allocate resources efficiently, and make data-driven decisions about where to focus repair efforts first.

## 2. Architecture and Data Sources

The CityFix architecture follows the distributed service model characteristic of spatial information infrastructures, connecting multiple data sources through standardized OGC interfaces.

### External Interoperable Service (WMS)

We consume an external Web Map Service (WMS) from Stadt Münster (https://www.stadt-muenster.de/ows/mapserv706/odalkisserv), which provides the official city boundary layer ("stadtgebiet"). This layer is rendered transparently over the OpenStreetMap basemap, providing authoritative geographic context for issue reports. The WMS integration demonstrates the interoperability principle of SII—we can incorporate official government spatial data without local storage or data conversion.

### Own Dataset and Service (WFS)

We created a point dataset representing street issue reports stored as an ESRI Shapefile. Each feature contains six attributes:

- **id**: Unique identifier (string)
- **category**: Issue type (broken_light, roadwork, blockage)
- **status**: Current state (open, in_progress, resolved)
- **severity**: Priority level (1-5 scale)
- **descriptio**: Issue description (truncated to 10 characters due to Shapefile limitations)
- **timestamp**: Report datetime (ISO format)

The dataset is published through GeoServer as a Web Feature Service (WFS), enabling both read operations (GetFeature) for visualization and write operations (WFS-T Insert transactions) for adding new reports. We chose WFS version 1.1.0 for its transaction support and GeoJSON output capability.

### Client Application

The web client is built using Leaflet, a lightweight JavaScript mapping library. It connects to both services: fetching the WMS layer as a tile overlay and requesting WFS features as GeoJSON for dynamic rendering. The client runs entirely in the browser, requiring only a simple HTTP server for local development.

## 3. Implementation Features

Beyond the core requirements, we implemented several features to enhance usability:

**Color-Coded Severity Visualization**: Issues are displayed as circle markers colored by severity—green for minor (1), orange for moderate (2-3), and red for severe (4-5). This enables immediate visual identification of critical issues.

**Interactive Filtering**: Users can filter displayed issues by category and status through checkbox controls. The filtering operates client-side, instantly showing or hiding markers based on selected criteria.

**Issue Reporting Form**: A key feature is the ability to submit new issues directly from the map. Users click to set a location, fill in category, severity, and description, and submit. The application sends a WFS-T Insert transaction to GeoServer, persisting the new feature to the Shapefile. This demonstrates the bidirectional capability of WFS and transforms the application from a passive viewer to an active data collection tool.

**Styled User Interface**: Custom-styled legend and filter panels provide a professional appearance while maintaining usability. The report form appears as a side panel, allowing users to click the map for location selection without modal interference.

## 4. Experiences and Lessons Learned

Several technical challenges provided valuable learning experiences:

**CORS Configuration**: Browser security policies initially blocked requests from the file system to GeoServer. We resolved this by serving the client through a local HTTP server and enabling CORS in GeoServer's web.xml configuration.

**Namespace Management**: WFS-T transactions require precise XML namespace matching. Our initial hardcoded namespace failed; we resolved this by dynamically fetching the correct namespace from GeoServer's DescribeFeatureType response.

**Shapefile Limitations**: The 10-character attribute name limit in Shapefiles required truncating "description" to "descriptio"—a reminder that format constraints influence data modeling decisions.

**GeoServer Setup**: Configuring workspace, datastore, and layer publishing in GeoServer reinforced understanding of the service stack between raw data and standardized interfaces.

## 5. Conclusion

CityFix successfully demonstrates SII principles by integrating external WMS data with a locally-published WFS dataset through a web client application. The project shows how standardized interfaces enable interoperability between distributed spatial data sources, and how adding transactional capabilities (WFS-T) creates truly interactive geographic applications. The experience reinforced that while standards provide the foundation for interoperability, practical implementation requires attention to configuration details like namespaces, CORS policies, and data format constraints.
