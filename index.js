const express = require("express"); // import express
const cors = require("cors"); // import cors
const { MongoClient } = require("mongodb"); // import mongoDb
const admin = require("firebase-admin");

const app = express(); // initialize app
const port = process.env.PORT || 4500; // port number
require("dotenv").config();
const ObjectId = require("mongodb").ObjectId; // mongo db er id use korar middleware

app.use(cors()); // app use middleware to cors
app.use(express.json()); // json a convert korar middleware

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4v0cg.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function verifyToken(req, res, next) {
  if (req?.headers?.authorization?.startsWith("Bearer ")) {
    const token = req?.headers?.authorization?.split("Bearer ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch (err) {
      console.log(err.message);
    }
  }
  next();
}

async function run() {
  try {
    await client.connect();
    console.log("database connection successful");
    const database = client.db("doctor_portal");
    const usersCollection = database.collection("users");
    const appointmentCollection = database.collection("appointments");

    app.post("/appointments", async (req, res) => {
      const data = req.body;
      const result = await appointmentCollection.insertOne(data);
      res.json(result);
    });

    app.get("/appointments", async (req, res) => {
      const email = req.query.email;
      const date = req.query.date;
      const query = { email: email, date: date };
      const result = await appointmentCollection.find(query).toArray();
      res.send(result);
    });

    // user adding api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      console.log(result);
      res.json(result);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const option = { upsert: true };
      const updatedDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        option
      );
      res.json(result);
    });

    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const adder = req.decodedEmail;
      if (adder) {
        const adderInfo = await usersCollection.findOne({ email: adder });
        if (adderInfo.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res.status(403).json({ message: "you not a admin" });
      }
    });
    // check us user admin
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAmin = false;
      if (user?.role === "admin") isAmin = true;
      res.json({ admin: isAmin });
    });
  } finally {
    // await client.close();
  }
}

run().catch(() => console.dir);

app.get("/", (req, res) => {
  // test api
  res.send("welcome to doctor-portal  server");
});

app.listen(4500, () => {
  console.log("Listening server port :", port);
});
