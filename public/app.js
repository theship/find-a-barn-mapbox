let map;
let mapLoaded = false;

// Parse input to determine if it's coordinates or address
function parseInput(input) {
    input = input.trim();
    const coordPattern = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/;
    const match = input.match(coordPattern);
    
    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { type: 'coordinates', lat, lng };
        }
    }
    return { type: 'address', query: input };
}

// Get Mapbox token from server
async function getMapboxToken() {
    const response = await fetch('/config');
    const data = await response.json();
    return data.mapboxToken;
}

// Initialize map when the page loads
async function initializeMap() {
    try {
        const token = await getMapboxToken();
        mapboxgl.accessToken = token;

        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-122.416166, 37.738875], // San Francisco
            zoom: 19
        });

        map.addControl(new mapboxgl.NavigationControl());

        // Wait for map to load before setting up sources and layers
        await new Promise(resolve => map.on('load', resolve));
        mapLoaded = true;

        // Add source and layer for building polygons
        map.addSource('buildings', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        map.addLayer({
            id: 'building-polygons',
            type: 'fill-extrusion', // Change to 3D buildings
            source: 'buildings',
            paint: {
                'fill-extrusion-color': '#ff0000',
                'fill-extrusion-opacity': 0.6,
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height']
            }
        });        

        // Add click handler
        map.on('click', async (e) => {
            const { lng, lat } = e.lngLat;
            await searchBuildings(lat, lng);
        });

    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// In searchBuildings function, update how we process the features
async function searchBuildings(lat, lng) {
    try {
        const response = await fetch(`/find-buildings?lat=${lat}&lon=${lng}`);
        const data = await response.json();

        console.log('Raw building data:', JSON.stringify(data, null, 2));

        if (!data?.features?.length) {
            console.warn("No valid building data received");
            alert("Error: No buildings found at this location");
            return;
        }

        if (!mapLoaded) {
            console.warn('Map not yet loaded');
            return;
        }

        const source = map.getSource('buildings');
        if (!source) return;

        source.setData(data); // ✅ Update the map with new building data

        // Calculate bounds from the features
        const bounds = data.features.reduce((b, feature) => {
            if (feature.geometry?.type === 'Polygon') {
                feature.geometry.coordinates[0].forEach(coord => b.extend(coord));
            }
            return b;
        }, new mapboxgl.LngLatBounds());

        if (bounds.isEmpty()) return;

        // ✅ Fit the map to building bounds, then refine zoom
        map.fitBounds(bounds, { padding: 10, maxZoom: 19, duration: 800 });

        setTimeout(() => map.flyTo({
            center: bounds.getCenter(),
            zoom: 19,
            speed: 1.5
        }), 1000); // Smooth transition to desired zoom

    } catch (error) {
        console.error('❌ Error searching buildings:', error);
        alert("Error fetching buildings data");
    }
}

async function geocodeLocation(query) {
    const response = await fetch(`/geocode?query=${encodeURIComponent(query)}`);
    return await response.json();
}

// Main search function
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
            await searchBuildings(parsedInput.lat, parsedInput.lng);
        } else {
            const geocodeData = await geocodeLocation(parsedInput.query);
            
            if (geocodeData.features && geocodeData.features.length > 0) {
                const [lon, lat] = geocodeData.features[0].center;
                await searchBuildings(lat, lon);
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
