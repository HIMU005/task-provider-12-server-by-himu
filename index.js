const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6xa5uzm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // collections
    const userCollection = client.db("taskProvider").collection("users");
    const taskCollection = client.db("taskProvider").collection("tasks");
    const purchaseCollection = client
      .db("taskProvider")
      .collection("purchases");
    const submissionCollection = client
      .db("taskProvider")
      .collection("submission");

    // jwt relate api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "3h",
      });
      res.send({ token });
    });

    // Verify Token Middleware
    const verifyToken = async (req, res, next) => {
      const token = req.cookies?.token;
      console.log(token);
      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          console.log(err);
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.user = decoded;
        next();
      });
    };

    // create-payment-intent
    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.price.price;

      const priceInCent = parseFloat(price) * 100;
      // if (!price || priceInCent < 1) return;
      // generate clientSecret
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
        // payment_method_types: ["card"],
      });
      // send client secret as response
      res.send({ clientSecret: client_secret });
    });

    // save purchase coin information in database
    app.post("/purchase-coin", async (req, res) => {
      const purchaseInfo = req.body;
      const result = await purchaseCollection.insertOne(purchaseInfo);
      res.send(result);
    });

    // get purchase information
    app.get("/purchase-coin", async (req, res) => {
      const result = await purchaseCollection.find().toArray();
      res.send(result);
    });

    app.get("/purchase-coin/:email", async (req, res) => {
      const email = req.params.email;
      const result = await purchaseCollection.find({ email }).toArray();
      res.send(result);
    });

    // save the new user document in database
    app.post("/users", async (req, res) => {
      const userData = req.body;
      const result = await userCollection.insertOne(userData);
      res.send(result);
    });

    // get all user data
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // get an user role
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    // update the coin information in for a single user
    app.patch("/user/:email", async (req, res) => {
      const email = req.params.email;
      const updateData = req.body;
      const filter = { email };
      const updateDoc = {
        $set: { coin: updateData.newCoin },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // update role of an user
    app.patch("/user/role/:email", async (req, res) => {
      const email = req.params.email;
      const { newRole } = req.body;
      const updateDoc = {
        $set: { role: newRole },
      };
      const result = await userCollection.updateOne({ email }, updateDoc);
      res.send(result);
    });

    // add task details in the db
    app.post("/tasks", async (req, res) => {
      const taskData = req.body;
      const result = await taskCollection.insertOne(taskData);
      res.send(result);
    });

    // get all tasks
    app.get("/tasks", async (req, res) => {
      const result = await taskCollection.find().toArray();
      res.send(result);
    });

    // all posted task by a user
    app.get("/tasks/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "taskProvider.email": email };
      const result = await taskCollection.find(query).toArray();
      res.send(result);
    });

    // single task by Id
    app.get("/task/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await taskCollection.findOne(query);
      res.send(result);
    });

    // update task details
    app.patch("/task/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateData = req.body;
      const updateDoc = {
        $set: {
          taskName: updateData.taskName,
          subInfo: updateData.subInfo,
          taskDetails: updateData.taskDetails,
        },
      };
      console.log(updateDoc);
      const result = await taskCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // submission details save in database
    app.post("/submissions", async (req, res) => {
      const submitData = req.body;
      const result = await submissionCollection.insertOne(submitData);
      res.send(result);
    });

    // get all submission by a user
    app.get("/submissions/:email", async (req, res) => {
      const email = req.params.email;
      const result = await submissionCollection
        .find({ workerEmail: email })
        .toArray();
      res.send(result);
    });

    // get all submissions
    app.get("/submissions", async (req, res) => {
      const result = await submissionCollection.find().toArray();
      res.send(result);
    });

    // update status
    app.patch("/submission/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const { status } = req.body;
      console.log(status);
      const updateDoc = {
        $set: { status },
      };
      const result = await submissionCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // delete submission
    // app.delete("/submission/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const result = await submissionCollection.deleteOne(query);
    //   res.send(result);
    // });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Assignment 12 running");
});

app.listen(port, () => {
  console.log("running on", port);
});
