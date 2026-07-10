const express = require("express");
const axios = require("axios");
const GtfsRealtimeBindings = require("gtfs-realtime-bindings");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("."));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// -------------------------
// Weather + UV (Brisbane)
// -------------------------

app.get("/weather", async (req, res) => {

  try {

    const response = await axios.get(
      "https://api.open-meteo.com/v1/forecast",
      {
        params: {
          latitude: -27.4698,
          longitude: 153.0251,
          current:
            "temperature_2m,weather_code",
          daily:
            "uv_index_max",
          timezone:
            "Australia/Brisbane"
        }
      }
    );


    res.json({

      temperature:
        response.data.current.temperature_2m,

      uv:
        response.data.daily.uv_index_max[0],

      weatherCode:
        response.data.current.weather_code

    });


  } catch(err) {

    console.log(err.response?.data || err.message);

    res.status(500).json({
      error:"Weather unavailable"
    });

  }

});




// -------------------------
// Route 555 Bus API
// -------------------------

app.get("/buses", async (req,res)=>{


try {


const response = await axios({

method:"get",

url:
"https://gtfsrt.api.translink.com.au/api/realtime/SEQ/TripUpdates",

responseType:"arraybuffer"

});



const feed =
GtfsRealtimeBindings
.transit_realtime
.FeedMessage
.decode(
new Uint8Array(response.data)
);



const STOP_ID = "600656";
const ROUTE = "555";


const now =
Math.floor(Date.now()/1000);



let buses=[];



feed.entity.forEach(entity=>{


if(!entity.tripUpdate)
return;



const trip =
entity.tripUpdate.trip;



if(!trip)
return;



if(trip.routeId !== ROUTE)
return;



entity.tripUpdate.stopTimeUpdate
.forEach(stop=>{


if(stop.stopId !== STOP_ID)
return;


if(!stop.departure)
return;



const departure =
Number(stop.departure.time.low);



const minutes =
Math.round(
(departure-now)/60
);



if(minutes>=0){


buses.push({

route: ROUTE,

tripId:
trip.tripId,

minutesAway:
minutes,

departureISO:
new Date(
departure*1000
).toISOString()

});


}


});


});



buses.sort(
(a,b)=>
a.minutesAway-b.minutesAway
);



res.json({

fetchedAt:
new Date().toISOString(),

buses:
buses.slice(0,3)

});


}
catch(err){

console.log(err.message);


res.status(500).json({

error:
"Unable to fetch buses"

});


}


});




// -------------------------
// Start server
// -------------------------

const PORT =
process.env.PORT || 3000;


app.listen(
PORT,
"0.0.0.0",
()=>{

console.log(
`Yuki Dashboard running on port ${PORT}`
);

});
