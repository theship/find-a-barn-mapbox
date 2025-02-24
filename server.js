/**
 * 🌍 Mapbox API Server
 * Express.js backend providing endpoints for geocoding and building footprint retrieval.
 * 
 * Dependencies:
 * - Express.js (Web framework)
 * - Node-fetch (Fetch API for making HTTP requests)
 * - @mapbox/vector-tile & pbf (For parsing Mapbox Vector Tiles)
 * - dotenv (For environment variables)
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

// Ensure Mapbox Token is set before starting server
if (!MAPBOX_TOKEN) {
    console.error("❌ Missing MAPBOX_ACCESS_TOKEN in .env file");
    process.exit(1);
}

app.use(cors());
app.use(express.static("public"));

/**
 * 🔑 Serve Mapbox token to frontend
 * This allows the client to retrieve the Mapbox access token without exposing it in frontend code.
 */
app.get("/config", (req, res) => {
    res.json({ mapboxToken: MAPBOX_TOKEN });
});

/**
 * 📍 Geocode an address using Mapbox API
 * Converts an address or place name into latitude and longitude coordinates.
 * 
 * Request Query Params:
 * - query (string): The address or place name to geocode.
 * 
 * Example:
 * GET /geocode?query=San Francisco
 */
app.get("/geocode", async (req, res) => {
    const query = req.query.query;
    if (!query) return res.status(400).json({ error: "❌ Missing query parameter" });

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}`;
    console.log(`🔍 Geocoding request: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log("✅ Geocode API Response:", JSON.stringify(data, null, 2));
        res.json(data);
    } catch (error) {
        console.error("❌ Error fetching geocode data:", error);
        res.status(500).json({ error: "Failed to fetch geocode data" });
    }
});

/**
 * 🔄 Convert lat/lon to Mapbox Tile coordinates
 * Mapbox Vector Tiles use a (z, x, y) coordinate system for tile retrieval.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} zoom - Map zoom level
 * @returns {Object} { xtile, ytile } corresponding tile coordinates
 */
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

/**
 * 🏗️ Fetch building footprints using Mapbox Vector Tiles API
 * Retrieves and parses vector tiles to extract building polygon data.
 * 
 * Request Query Params:
 * - lat (number): Latitude coordinate
 * - lon (number): Longitude coordinate
 * 
 * Example:
 * GET /find-buildings?lat=37.7749&lon=-122.4194
 */
app.get("/find-buildings", async (req, res) => {
    const { lat, lon } = req.query;

    // Validate latitude and longitude
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
        console.error("❌ Invalid or missing lat/lon parameters.");
        return res.status(400).json({ error: "❌ Missing or invalid lat/lon parameters" });
    }

    const zoom = 19; // High zoom level for detailed buildings
    const { xtile, ytile } = degToTileXY(parseFloat(lat), parseFloat(lon), zoom);

    const tileset_id = "mapbox.mapbox-streets-v8"; // Mapbox Tileset
    const format = "mvt"; // Mapbox Vector Tile format
    const url = `https://api.mapbox.com/v4/${tileset_id}/${zoom}/${xtile}/${ytile}.${format}?access_token=${MAPBOX_TOKEN}`;

    console.log(`🔍 Fetching Mapbox tile: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Mapbox API Error: ${response.status} - ${errorText}`);
            return res.status(response.status).json({ error: `Mapbox API Error: ${errorText}` });
        }

        // Parse binary Mapbox Vector Tile (MVT) data
        const tileData = await response.arrayBuffer();
        const tile = new VectorTile(new Pbf(tileData));

        // Extract "building" layer from tile
        const buildingsLayer = tile.layers['building'];
        if (!buildingsLayer) {
            console.warn("⚠️ No 'building' layer found in the tile.");
            return res.json({ type: "FeatureCollection", features: [] });
        }

        // Convert Mapbox vector tile features to GeoJSON
        let features = [];
        for (let i = 0; i < buildingsLayer.length; i++) {
            const feature = buildingsLayer.feature(i).toGeoJSON(xtile, ytile, zoom);
            features.push(feature);
        }

        console.log(`✅ Successfully extracted ${features.length} building features.`);
        res.json({ type: "FeatureCollection", features });

    } catch (error) {
        console.error("❌ Internal Server Error:", error.message);
        res.status(500).json({ error: `Internal Server Error: ${error.message}` });
    }
});

/**
 * 🚀 Start Express server
 */
app.listen(PORT, () => console.log(`🎯 Server running at: http://localhost:${PORT}`));
