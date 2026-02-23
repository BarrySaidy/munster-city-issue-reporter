Overview:

This project demonstrates interoperability in a Spatial Information Infrastructure (SII) by integrating:

An external OGC WMS service (Münster city boundary)

A self-published WFS service (issue reports)

A Leaflet client consuming both services

Requirements:

Java 17 (Temurin recommended)

GeoServer 2.28.x

How to Run the Project:

1- Start GeoServer:
Navigate to:
geoserver/bin/startup.bat
open: http://localhost:8080/geoserver

2- Publish the Dataset:
Login to geoserver (username: admin / password: geoserver)
Create workspace: Name: cityfix   
Add Store: Type: Shapefile , Upload: Münster-Issues.shp  (inside CityFix/data )
Publish Layer: Name: Münster-Issues
    CRS: EPSG:4326
    Compute Bounding Boxes
    Save

Test WFS:
http://localhost:8080/geoserver/cityfix/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=cityfix:M%C3%BCnster-Issues&outputFormat=application/json

3- Start the Client Application (Leaflet)
The client application is the Leaflet web map located in the main cityfix folder.
Steps:

Ensure GeoServer is running: (geoserver/bin/startup.bat)
Open the cityfix project folder, click on index.html
The Leaflet map will open in your browser.

What Should Appear:

The web application should display:
OpenStreetMap basemap
Münster city boundary (external WMS service)
Issue report points (served via GeoServer WFS)
Click on a point → popup displays:
ID
Category
Status
Severity
Description
Timestamp



Important Notes:
GeoServer must be running before opening index.html.
Java 17 is required for GeoServer.
Due to the 10-character limitation of the ESRI Shapefile format, the attribute “Description” was truncated to “descriptio”.
CORS is enabled in GeoServer to allow the Leaflet client to fetch WFS data.




