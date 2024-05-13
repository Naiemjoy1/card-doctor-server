const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const moment = require("moment");
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://cozystay-hotel-booking.web.app",
      "https://cozystay-hotel-booking.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ccm0dfs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middlewares
const logger = async (req, res, next) => {
  console.log("log info", req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log("value of token in middleware", token);
  if (!token) {
    return res.status(401).send({ message: "not authorize" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized" });
    }
    console.log("value in the token", decoded);
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    // await client.connect();

    const roomCollection = client.db("roomBook").collection("rooms");
    const bookingCollection = client.db("roomBook").collection("bookings");
    const reviewCollection = client.db("roomBook").collection("reviews");

    // auth api
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // rooms
    app.get("/rooms", logger, async (req, res) => {
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
    app.get("/bookings", logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      //   console.log("token", req.cookies.token);

      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      console.log();

      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/bookings/:id", logger, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
    });

    // New route to get bookings by room_id
    app.get("/bookings/room/:room_id", logger, async (req, res) => {
      const room_id = req.params.room_id;
      const query = { room_id: room_id };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/bookings", logger, async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.post("/bookings/:id/cancel", logger, async (req, res) => {
      const bookingId = req.params.id;

      try {
        // Retrieve the booking from the database
        const booking = await bookingCollection.findOne({
          _id: new ObjectId(bookingId),
        });

        if (!booking) {
          return res.status(404).json({ message: "Booking not found" });
        }

        // Check if the cancellation deadline has passed
        const currentDate = moment();
        const checkInDate = moment(booking.checkInDate);
        const cancellationDeadline = checkInDate.subtract(1, "days");

        if (currentDate.isAfter(cancellationDeadline)) {
          return res
            .status(400)
            .json({ message: "Cancellation deadline has passed" });
        }

        // Check if the check-in date is more than 24 hours away
        if (checkInDate.diff(currentDate, "hours") <= 24) {
          return res.status(400).json({
            message: "Check-in date is less than or equal to 24 hours away",
          });
        }

        // Update the booking status to canceled
        const updateResult = await bookingCollection.updateOne(
          { _id: new ObjectId(bookingId) },
          { $set: { status: "canceled" } }
        );

        // Make the room available again
        await roomCollection.updateOne(
          { _id: new ObjectId(booking.room_id) },
          { $set: { available: true } }
        );

        // Delete the booking
        const deleteResult = await bookingCollection.deleteOne({
          _id: new ObjectId(bookingId),
        });

        res.status(200).json({ message: "Booking canceled successfully" });
      } catch (error) {
        console.error("Error canceling booking:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/bookings/:id", logger, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    app.put("/bookings/:id", logger, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDetails = req.body;
      const details = {
        $set: {
          checkInDate: updatedDetails.checkInDate,
          checkOutDate: updatedDetails.checkOutDate,
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
