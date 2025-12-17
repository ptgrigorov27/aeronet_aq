import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
const PORT = 4000;

app.use(
  cors({
    origin: ["https://aeronet.gsfc.nasa.gov"], // production frontend origin
  })
);

const OPENAQ_KEY = process.env.VITE_OPENAQ_API_KEY;

app.get("/aqi/openaq/locations", async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;

    const response = await axios.get(
      `https://api.openaq.org/v3/locations`,
      {
        params: { page, limit },
        headers: { "X-API-Key": OPENAQ_KEY },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error("OpenAQ proxy error:", err.message);
    res.status(500).json({ error: "Failed to fetch OpenAQ data" });
  }
});

app.listen(PORT, () => {
  console.log(`OpenAQ proxy running on port ${PORT}`);
});

