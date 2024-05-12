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

    app.get("/rooms/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomCollection.findOne(query);
      res.send(result);
    });

    // bookings
    app.get("/bookings", async (req, res) => {
      console.log(req.query.email);
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
    });

    // New route to get bookings by room_id
    app.get("/bookings/room/:room_id", async (req, res) => {
      const room_id = req.params.room_id;
      const query = { room_id: room_id };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    app.put("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDetails = req.body;
      const details = {
        $set: {
          checkInDate: updatedDetails.checkInDate,
          checkOutDate: updatedDetails.checkOutDate, // Corrected to 'checkOutDate'
          numRooms: updatedDetails.numRooms,
          numAdults: updatedDetails.numAdults,
          numChildren: updatedDetails.numChildren,
          totalCost: updatedDetails.totalCost,
          pricePerNight: updatedDetails.pricePerNight,
        },
      };
      const result = await bookingCollection.updateOne(
        filter,
        details,
        options
      );

      // Sending a response indicating success or failure
      if (result.modifiedCount > 0) {
        res.status(200).json({ message: "Booking updated successfully" });
      } else {
        res.status(404).json({ message: "Booking not found" });
      }
    });

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

    app.get("/reviews/:review_id", async (req, res) => {
      const review_id = req.params.review_id;
      const query = { review_id: review_id };
      const result = await reviewCollection.findOne(query);
      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      const review = req.body;
      console.log(review);
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
