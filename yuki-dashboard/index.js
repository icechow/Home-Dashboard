const express = require("express");
const axios = require("axios");
const GtfsRealtimeBindings = require("gtfs-realtime-bindings");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.send("Yuki Dashboard server is working");
});
app.get("/buses", async (req, res) => {
  try {
    const response = await axios({
      method: "get",
      url: "https://gtfsrt.api.translink.com.au/api/realtime/SEQ/TripUpdates",
      responseType: "arraybuffer",
    });

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(response.data),
    );

    const STOP_ID = "600656"; // Loganholme
    const ROUTE = "555";

    const now = Math.floor(Date.now() / 1000);

    let buses = [];

    feed.entity.forEach((entity) => {
      if (!entity.tripUpdate) return;

      const trip = entity.tripUpdate.trip;

      if (!trip) return;

      if (trip.routeId !== ROUTE) return;

      entity.tripUpdate.stopTimeUpdate.forEach((stop) => {
        if (stop.stopId !== STOP_ID) return;

        if (!stop.departure) return;

        const minutes = Math.round((stop.departure.time.low - now) / 60);

        if (minutes >= 0) {
          buses.push({
            route: ROUTE,
            destination: "Brisbane City",
            minutes: minutes,
          });
        }
      });
    });

    buses.sort((a, b) => a.minutes - b.minutes);

    res.json({
        fetchedAt: new Date().toISOString(),
        buses: buses.slice(0, 3)
    });
  } catch (err) {
    console.log(err.message);

    res.status(500).json({
      error: "Unable to fetch buses",
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Yuki Dashboard running on port ${PORT}`);
});
