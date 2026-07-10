import { Router, type IRouter } from "express";
import axios from "axios";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
const { transit_realtime } = GtfsRealtimeBindings;

const router: IRouter = Router();

const GTFS_FEED_URL =
  "https://gtfsrt.api.translink.com.au/api/realtime/SEQ/TripUpdates";
const TARGET_ROUTE = "555";
const TARGET_STOP = "600656";

router.get("/buses", async (req, res) => {
  try {
    const headers: Record<string, string> = { "Cache-Control": "no-cache" };
    if (process.env.TRANSLINK_API_KEY) {
      headers["Authorization"] = `apikey ${process.env.TRANSLINK_API_KEY}`;
    }

    const response = await axios.get<ArrayBuffer>(GTFS_FEED_URL, {
      responseType: "arraybuffer",
      headers,
      timeout: 10000,
    });

    const feed = transit_realtime.FeedMessage.decode(
      new Uint8Array(response.data),
    );

    const now = Math.floor(Date.now() / 1000);
    const upcoming: {
      tripId: string | null;
      routeId: string;
      stopId: string;
      stopSequence: number | null;
      departureTime: number;
      departureISO: string;
      minutesAway: number;
    }[] = [];

    for (const entity of feed.entity) {
      if (!entity.tripUpdate) continue;
      const trip = entity.tripUpdate.trip;
      if (trip.routeId !== TARGET_ROUTE) continue;

      for (const stu of entity.tripUpdate.stopTimeUpdate) {
        if (stu.stopId === TARGET_STOP) {
          const rawTime =
            stu.departure?.time != null
              ? stu.departure.time
              : stu.arrival?.time ?? null;

          if (rawTime == null) break;

          const departureTime =
            typeof rawTime === "object" && "toNumber" in rawTime
              ? (rawTime as { toNumber(): number }).toNumber()
              : Number(rawTime);

          if (isNaN(departureTime) || departureTime <= now) break;

          upcoming.push({
            tripId: trip.tripId ?? null,
            routeId: trip.routeId ?? TARGET_ROUTE,
            stopId: TARGET_STOP,
            stopSequence: stu.stopSequence ?? null,
            departureTime,
            departureISO: new Date(departureTime * 1000).toISOString(),
            minutesAway: Math.ceil((departureTime - now) / 60),
          });
          break;
        }
      }
    }

    upcoming.sort((a, b) => a.departureTime - b.departureTime);

    res.json({
      route: TARGET_ROUTE,
      stop: TARGET_STOP,
      stopName: "Loganholme",
      fetchedAt: new Date().toISOString(),
      buses: upcoming.slice(0, 3),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Failed to fetch GTFS feed");
    res.status(502).json({ error: "Failed to fetch realtime data", detail: message });
  }
});

export default router;
