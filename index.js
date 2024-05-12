const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ccm0dfs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();

    const roomCollection = client.db("roomBook").collection("rooms");
    const bookingCollection = client.db("roomBook").collection("bookings");
    const reviewCollection = client.db("roomBook").collection("reviews");

    app.get("/rooms", async (req, res) => {
      const { minPrice, maxPrice } = req.query;

      let filter = {};
      if (minPrice && maxPrice) {
        filter = {
          pricePerNight: { $gte: parseInt(minPrice), $lte: parseInt(maxPrice) },
        };
      } else if (minPrice) {
        filter = { pricePerNight: { $gte: parseInt(minPrice) } };
      } else if (maxPrice) {
        filter = { pricePerNight: { $lte: parseInt(maxPrice) } };
      }

      const cursor = roomCollection.find(filter).sort({ pricePerNight: 1 }); // Sort by pricePerNight in ascending order
      const result = await cursor.toArray();
      res.send(result);
    });

    // bookings
    // Add your booking routes here

    // review
    app.get("/reviews", async (req, res) => {
      const { minRating, maxRating } = req.query;

      let filter = {};
      if (minRating && maxRating) {
        filter = {
          rating: { $gte: parseInt(minRating), $lte: parseInt(maxRating) },
        };
      } else if (minRating) {
        filter = { rating: { $gte: parseInt(minRating) } };
      } else if (maxRating) {
        filter = { rating: { $lte: parseInt(maxRating) } };
      }

      const result = await reviewCollection.find(filter).toArray();
      res.send(result);
    });

    // Add your other review routes here

    // Send a ping to confirm a successful connection
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("hotel booking server is running");
});

app.listen(port, () => {
  console.log(`hotel booking server is running on port ${port}`);
});
