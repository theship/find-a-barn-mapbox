require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

if (!MAPBOX_TOKEN) {
    console.error("❌ Missing MAPBOX_ACCESS_TOKEN in .env file");
    process.exit(1);
}

app.use(cors());
app.use(express.static("public"));

// Serve Mapbox token to frontend
app.get("/config", (req, res) => {
    res.json({ mapboxToken: MAPBOX_TOKEN });
});

// Geocode API endpoint
app.get("/geocode", async (req, res) => {
    const query = req.query.query;
    if (!query) return res.status(400).json({ error: "Missing query parameter" });

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error fetching geocode data:", error);
        res.status(500).json({ error: "Failed to fetch geocode data" });
    }
});

// Get the building polygons, using the Vector Tile API
function degToTileXY(lat, lon, zoom) {
    const n = 2 ** zoom;
    let xtile = Math.floor((lon + 180) / 360 * n);
    let ytile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);

    // Ensure values are positive integers
    xtile = Math.max(0, xtile);
    ytile = Math.max(0, ytile);

    return { xtile, ytile };
}

const { VectorTile } = require('@mapbox/vector-tile');
const Pbf = require('pbf').default;

app.get("/find-buildings", async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
        console.error("❌ Missing lat/lon parameters");
        return res.status(400).json({ error: "Missing lat/lon parameters" });
    }

    const zoom = 19;
    const { xtile, ytile } = degToTileXY(parseFloat(lat), parseFloat(lon), zoom);

    const tileset_id = "mapbox.mapbox-streets-v8";
    const format = "mvt";
    const url = `https://api.mapbox.com/v4/${tileset_id}/${zoom}/${xtile}/${ytile}.${format}?access_token=${MAPBOX_TOKEN}`;

    console.log(`🔍 Fetching Mapbox data from: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Mapbox API Error: ${response.status} - ${errorText}`);
            return res.status(response.status).json({ error: `Mapbox API Error: ${errorText}` });
        }

        // Parse the binary Vector Tile (MVT) data
        const tileData = await response.arrayBuffer();
        const tile = new VectorTile(new Pbf(tileData));

        // Extract buildings layer (Mapbox uses "building" layer)
        const buildingsLayer = tile.layers['building']; // <-- Check the layer name
        if (!buildingsLayer) {
            return res.json({ type: "FeatureCollection", features: [] });
        }

        let features = [];
        for (let i = 0; i < buildingsLayer.length; i++) {
            const feature = buildingsLayer.feature(i).toGeoJSON(xtile, ytile, zoom);
            features.push(feature);
        }

        console.log(`✅ Converted ${features.length} building features to GeoJSON`);
        res.json({ type: "FeatureCollection", features });

    } catch (error) {
        console.error("❌ Internal Server Error:", error.message);
        res.status(500).json({ error: `Internal Server Error: ${error.message}` });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
