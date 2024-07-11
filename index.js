
const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5555 ;
const app = express() ;

app.use(cors()) ;
app.use(express.json()) ;
require("dotenv").config() ;


const uri = `mongodb+srv://rahat495:${process.env.DB_PASS}@cluster0.w0yjihf.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const schoolsCollection = client.db("EduManage").collection("schools") ;

    app.post('/addSchool' , async (req , res) => {
        const data = req.body ;
        const result = await schoolsCollection.insertOne(data) ;
        res.send(result) ;
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/' , (req , res) => {
    res.send("school server is running !")
})

app.listen(port , () => {
    console.log(`the server is running at port ${port}`);
})
