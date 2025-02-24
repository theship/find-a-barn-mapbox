// app.js
let map;
let currentMarker;

// Get Mapbox token from server
async function getMapboxToken() {
    const response = await fetch('/config');
    const data = await response.json();
    return data.mapboxToken;
}

// Initialize map when the page loads
async function initializeMap() {
    try {
        // Get token first
        const token = await getMapboxToken();
        mapboxgl.accessToken = token;

        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-122.416166, 37.738875], // San Francisco coordinates
            zoom: 18
        });

        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl());

        // Add click handler for the map
        map.on('click', async (e) => {
            const { lng, lat } = e.lngLat;
            
            // Update marker
            updateMarker([lng, lat]);
            
            // Find and highlight buildings
            try {
                const buildingsData = await findBuildingsAtLocation(lat, lng);
                if (buildingsData.features) {
                    highlightBuildings(buildingsData.features);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        });

    } catch (error) {
        console.error('Error initializing map:', error);
    }
}


// ... rest of your code stays the same ...
async function geocodeLocation(query) {
    const response = await fetch(`/geocode?query=${encodeURIComponent(query)}`);
    return await response.json();
}

async function findBuildingsAtLocation(lat, lon) {
    const response = await fetch(`/find-buildings?lat=${lat}&lon=${lon}`);
    return await response.json();
}

// Function to add or update marker
function updateMarker(lngLat) {
    if (currentMarker) {
        currentMarker.remove();
    }
    currentMarker = new mapboxgl.Marker()
        .setLngLat(lngLat)
        .addTo(map);
}

// Function to highlight buildings
function highlightBuildings(features) {
    // Remove existing building layer if it exists
    if (map.getLayer('buildings-highlight')) {
        map.removeLayer('buildings-highlight');
        map.removeSource('buildings-source');
    }

    if (features.length > 0) {
        map.addSource('buildings-source', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: features
            }
        });

        map.addLayer({
            id: 'buildings-highlight',
            type: 'fill',
            source: 'buildings-source',
            paint: {
                'fill-color': '#ff0000',
                'fill-opacity': 0.5
            }
        });
    }
}

// Take address or lat long pair from user
function parseInput(input) {
    // Remove any extra whitespace
    input = input.trim();
    
    // Check if input matches lat,long pattern
    const coordPattern = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/;
    const match = input.match(coordPattern);
    
    if (match) {
        // It's a lat,long pair
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        
        // Validate coordinates
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { type: 'coordinates', lat, lng };
        }
    }
    
    // If not coordinates, treat as address
    return { type: 'address', query: input };
}

// Main function to find buildings
window.findBuildings = async function() {
    const locationInput = document.getElementById('location');
    const input = locationInput.value;
    
    if (!input) {
        alert('Please enter a location');
        return;
    }

    try {
        const parsedInput = parseInput(input);
        
        if (parsedInput.type === 'coordinates') {
            // Direct coordinates
            const { lat, lng } = parsedInput;
            
            // Update map view
            map.flyTo({
                center: [lng, lat],
                zoom: 19,
                essential: true
            });

            // Add marker
            updateMarker([lng, lat]);

            // Find and highlight buildings
            const buildingsData = await findBuildingsAtLocation(lat, lng);
            if (buildingsData.features) {
                highlightBuildings(buildingsData.features);
            }
        } else {
            // Address lookup
            const geocodeData = await geocodeLocation(parsedInput.query);
            
            if (geocodeData.features && geocodeData.features.length > 0) {
                const [lon, lat] = geocodeData.features[0].center;
                
                // Update map view
                map.flyTo({
                    center: [lon, lat],
                    zoom: 19,
                    essential: true
                });

                // Add marker
                updateMarker([lon, lat]);

                // Find and highlight buildings
                const buildingsData = await findBuildingsAtLocation(lat, lon);
                if (buildingsData.features) {
                    highlightBuildings(buildingsData.features);
                }
            } else {
                alert('Location not found');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error finding location');
    }
}

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', initializeMap);
