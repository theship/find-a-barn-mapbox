require("dotenv").config();
const express = require("express");
const cors = require("cors");
// Change this line
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

// Add this endpoint in server.js
app.get("/config", (req, res) => {
    res.json({ mapboxToken: MAPBOX_TOKEN });
});

// Geocode API (Convert location to coordinates)
app.get("/geocode", async (req, res) => {
    const query = req.query.query;
    if (!query) return res.status(400).json({ error: "Missing query parameter" });

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error fetching geocode data:", error);
        res.status(500).json({ error: "Failed to fetch geocode data" });
    }
});

// Tilequery API (Find buildings at coordinates)
// In server.js, modify the find-buildings endpoint
app.get("/find-buildings", async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "Missing lat/lon parameters" });

    const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lon},${lat}.json?layers=building&radius=50&access_token=${MAPBOX_TOKEN}`;
    
    try {
        console.log('Requesting URL:', url); // Log the URL being requested
        const response = await fetch(url);
        
        if (!response.ok) {
            // Log detailed error information
            const errorText = await response.text();
            console.error('Mapbox API Error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`Mapbox API returned ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Detailed error:", error);
        res.status(500).json({ 
            error: "Failed to fetch building data",
            details: error.message 
        });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
