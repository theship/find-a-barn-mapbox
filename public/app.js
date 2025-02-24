/**
 * 🗺️ Mapbox Integration Script
 * This script initializes a Mapbox map, processes user input for location queries,
 * and fetches building footprint data using the Mapbox Vector Tiles API.
 * 
 * Dependencies: Mapbox GL JS, Express backend for API calls
 */

let map; // Mapbox map instance
let mapLoaded = false; // Flag to track map load state

/**
 * Parses the user input to determine whether it is a coordinate pair (lat, lng) 
 * or an address that needs to be geocoded.
 * 
 * @param {string} input - User-provided location input (coordinates or address)
 * @returns {Object} Parsed input with either coordinates or an address query
 */
function parseInput(input) {
    input = input.trim();
    const coordPattern = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/;
    const match = input.match(coordPattern);
    
    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);

        // Validate coordinate range
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { type: 'coordinates', lat, lng };
        }
    }

    // If not valid coordinates, treat as an address
    return { type: 'address', query: input };
}

/**
 * Fetches the Mapbox access token from the server.
 * 
 * @returns {Promise<string>} Resolves with the Mapbox access token.
 */
async function getMapboxToken() {
    try {
        const response = await fetch('/config');
        const data = await response.json();
        return data.mapboxToken;
    } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        alert("Failed to load Mapbox credentials.");
    }
}

/**
 * Initializes the Mapbox map instance and sets up event listeners.
 */
async function initializeMap() {
    try {
        const token = await getMapboxToken();
        if (!token) throw new Error("Missing Mapbox token");

        // Set Mapbox access token
        mapboxgl.accessToken = token;

        // Initialize Mapbox map instance
        map = new mapboxgl.Map({
            container: 'map', // DOM element ID
            style: 'mapbox://styles/mapbox/streets-v12', // Mapbox style URL
            center: [-122.416166, 37.738875], // Default center: San Francisco
            zoom: 19 // Initial zoom level
        });

        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl());

        // Ensure the map is fully loaded before proceeding
        await new Promise(resolve => map.on('load', resolve));
        mapLoaded = true;

        // Setup a GeoJSON source for dynamically updating building data
        map.addSource('buildings', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        // Add a 3D extrusion layer for buildings
        map.addLayer({
            id: 'building-polygons',
            type: 'fill-extrusion',
            source: 'buildings',
            paint: {
                'fill-extrusion-color': '#ff0000',
                'fill-extrusion-opacity': 0.6,
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height']
            }
        });

        // Handle map click events to fetch building data
        map.on('click', async (e) => {
            const { lng, lat } = e.lngLat;
            await searchBuildings(lat, lng);
        });

    } catch (error) {
        console.error('❌ Error initializing map:', error);
        alert("Map initialization failed.");
    }
}

/**
 * Fetches building data for a given latitude and longitude.
 * 
 * @param {number} lat - Latitude coordinate
 * @param {number} lng - Longitude coordinate
 */
async function searchBuildings(lat, lng) {
    try {
        const response = await fetch(`/find-buildings?lat=${lat}&lon=${lng}`);
        const data = await response.json();

        if (!data?.features?.length) {
            console.warn("No buildings found at this location.");
            alert("No buildings found at this location.");
            return;
        }

        if (!mapLoaded) {
            console.warn("Map is not yet fully loaded.");
            return;
        }

        const source = map.getSource('buildings');
        if (!source) return;

        // Update map with new building data
        source.setData(data);

        // Calculate bounding box of retrieved buildings
        const bounds = data.features.reduce((b, feature) => {
            if (feature.geometry?.type === 'Polygon') {
                feature.geometry.coordinates[0].forEach(coord => b.extend(coord));
            }
            return b;
        }, new mapboxgl.LngLatBounds());

        if (bounds.isEmpty()) return;

        // Fit map view to building bounds, ensuring a smooth user experience
        map.fitBounds(bounds, { padding: 10, maxZoom: 19, duration: 800 });

        setTimeout(() => {
            map.flyTo({
                center: bounds.getCenter(),
                zoom: 19,
                speed: 1.5
            });
        }, 1000); // Smooth transition to desired zoom level

    } catch (error) {
        console.error('❌ Error fetching building data:', error);
        alert("Error retrieving buildings.");
    }
}

/**
 * Geocodes an address query using the server-side Mapbox Geocoding API.
 * 
 * @param {string} query - Address input from user
 * @returns {Promise<Object>} Geocoding API response
 */
async function geocodeLocation(query) {
    try {
        const response = await fetch(`/geocode?query=${encodeURIComponent(query)}`);
        return await response.json();
    } catch (error) {
        console.error('❌ Geocoding error:', error);
        alert("Failed to geocode address.");
    }
}

/**
 * Handles user input from the search bar, determines whether it's a coordinate 
 * pair or an address, and performs the appropriate search.
 */
window.findBuildings = async function() {
    const locationInput = document.getElementById('location');
    const input = locationInput.value;

    if (!input) {
        alert('Please enter a location.');
        return;
    }

    try {
        const parsedInput = parseInput(input);

        if (parsedInput.type === 'coordinates') {
            await searchBuildings(parsedInput.lat, parsedInput.lng);
        } else {
            const geocodeData = await geocodeLocation(parsedInput.query);

            if (geocodeData.features?.length > 0) {
                const [lon, lat] = geocodeData.features[0].center;
                await searchBuildings(lat, lon);
            } else {
                alert('Location not found.');
            }
        }
    } catch (error) {
        console.error('❌ Search error:', error);
        alert('Error processing location search.');
    }
};

// Initialize the map when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeMap);
