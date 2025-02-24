# 🏗️ Find a Building - Mapbox App

A simple web app that allows users to find building footprints using **Mapbox Vector Tiles** and **GeoJSON**.  
Click on the map or enter coordinates to retrieve building data and visualize it.

> [!IMPORTANT]  
> The following code was developed via prompting to and answers from ChatGPT-4o, OpenAI. (February 24, 2025).

## 🚀 Features
- Uses **Mapbox Vector Tiles API** to fetch building footprints.
- Displays buildings as **3D extrusions** on an interactive Mapbox map.
- Supports **click-to-search** and **address lookup** via geocoding.
- Implements **smooth zooming and panning** for a better user experience.

---

## 📌 Setup Instructions

### 1️⃣ **Clone the Repository**
```sh
git clone https://github.com/your-username/find-a-building.git
cd find-a-building

### 2️⃣ Install Dependencies

```
npm install
```

### 3️⃣ Set Up Environment Variables

Create a .env file in the root directory and add your Mapbox Access Token:

```
MAPBOX_ACCESS_TOKEN=your-mapbox-token-here
```

### 4️⃣ Run the Server

```
node server.js
```

The app will be available at:
📍 http://localhost:3000

## 🎮 How to Use

* Enter an address or coordinates (latitude, longitude) in the search bar.
* Click "Find Buildings" to fetch building data.
* Click on the map to search for buildings at that location.

The map will automatically zoom in and highlight buildings.

## 🛠 Troubleshooting


### ❌ "Error: No buildings found at this location"

Ensure the location is within a mapped area.
Try adjusting the zoom level or moving the map.

### ❌ "Mapbox API Error: Unauthorized"

Your Mapbox Access Token is missing or invalid.
Run:

```
echo $MAPBOX_ACCESS_TOKEN
```

and verify it's set correctly in `.env`.

### ❌ "Buildings are not appearing"

* Check the browser console for any API request errors.
* Open Developer Tools (F12) → Network → Fetch/XHR and inspect the API response.

## 📜 License

This project is licensed under the MIT License.

## 🙌 Credits

* Mapbox for the mapping and vector tiles API.
* Node.js + Express for the backend.
* JavaScript + Mapbox GL JS for the frontend.


Happy mapping! 🌍🏗️