const express = require('express');
const cors = require('cors');
const axios = require('axios');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const path = require('path');

const app = express();
const PORT = process.env.PORT;

// TransLink GTFS Realtime feed URL (South East Queensland)
const GTFS_FEED_URL = 'https://gtfsrt.api.translink.com.au/api/v2/seq/trip-updates';

// Target route and stop
const TARGET_ROUTE = '555';
const TARGET_STOP = '600656'; // Loganholme

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/buses', async (req, res) => {
  try {
    const headers = { 'Cache-Control': 'no-cache' };
    // Support optional API key via env var
    if (process.env.TRANSLINK_API_KEY) {
      headers['Authorization'] = `apikey ${process.env.TRANSLINK_API_KEY}`;
    }

    const response = await axios.get(GTFS_FEED_URL, {
      responseType: 'arraybuffer',
      headers,
      timeout: 10000,
    });

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(response.data)
    );

    const now = Math.floor(Date.now() / 1000);
    const upcoming = [];

    for (const entity of feed.entity) {
      if (!entity.tripUpdate) continue;

      const trip = entity.tripUpdate.trip;
      if (trip.routeId !== TARGET_ROUTE) continue;

      for (const stu of entity.tripUpdate.stopTimeUpdate) {
        if (stu.stopId === TARGET_STOP) {
          // Use departure time if available, fall back to arrival
          const rawTime =
            stu.departure?.time != null
              ? stu.departure.time
              : stu.arrival?.time != null
              ? stu.arrival.time
              : null;

          if (rawTime == null) break;

          // gtfs-realtime-bindings uses Long for int64 — convert to JS number
          const departureTime =
            typeof rawTime === 'object' && rawTime.toNumber
              ? rawTime.toNumber()
              : Number(rawTime);

          if (departureTime > now) {
            const minutesAway = Math.round((departureTime - now) / 60);
            upcoming.push({
              tripId: trip.tripId,
              routeId: trip.routeId,
              stopId: TARGET_STOP,
              stopSequence: stu.stopSequence ?? null,
              departureTime,
              departureISO: new Date(departureTime * 1000).toISOString(),
              minutesAway,
            });
          }
          break; // only one entry per trip for this stop
        }
      }
    }

    // Sort ascending by departure time, return next 3
    upcoming.sort((a, b) => a.departureTime - b.departureTime);
    const next3 = upcoming.slice(0, 3);

    res.json({
      route: TARGET_ROUTE,
      stop: TARGET_STOP,
      stopName: 'Loganholme',
      fetchedAt: new Date().toISOString(),
      buses: next3,
    });
  } catch (err) {
    console.error('Failed to fetch GTFS feed:', err.message);
    res.status(502).json({
      error: 'Failed to fetch realtime data',
      detail: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Yuki Dashboard running on http://localhost:${PORT}`);
});
