const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const mongoose = require("mongoose");
const flightData = require("./flightData");

app.use(express.json());

mongoose
  .connect("mongodb://localhost:27017/project-108-DB", {})
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.post("/uploadFlight", (req, res) => {
  console.log("reach");
  try {
    const ADI_val = req.body.ADI;
    const HIS_val = req.body.HIS;
    const altitude_val = req.body.altitude;

    if (!ADI_val || !HIS_val || !altitude_val) {
      return res.status(401).json("fill paremters");
    }

    if (ADI_val > 100 || ADI_val < -100) {
      return res.status(402).json("ADI is not in valid range");
    }

    if (HIS_val > 360 || HIS_val < 0) {
      return res.status(402).json("HIS is not in valid range");
    }

    if (altitude_val > 3000 || altitude_val < 0) {
      return res.status(402).json("altitude is not in valid range");
    }

    const flightID = new mongoose.Types.ObjectId() + "";
    const flight = new flightData({
      ID: flightID,
      Altitude: altitude_val,
      HIS: HIS_val,
      ADI: ADI_val,
    });

    flight.save();

    return res.status(200).json({ flightID: flightID });
  } catch (err) {
    console.log(err);
    return res.status(500).json(err);
  }
});

app.post("/getFlight", async (req, res) => {
  const flightID = req.body.flightID;

  if (!flightID) {
    return res.status(400).json("flight not sented");
  }
  const flight = await flightData.find({ ID: flightID });

  if (!flight) {
    return res.status(404).json("flight not found");
  }

  return res.status(200).json(flight);
});
