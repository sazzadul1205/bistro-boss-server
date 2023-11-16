const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;

// Middle Ware
app.use(cors());
app.use(express.json());

// 

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@bistro-boss.fz5rhcr.mongodb.net/?retryWrites=true&w=majority`;

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
        await client.connect();

        const menuCollection = client.db('bistroDB').collection('menu');
        const reviewsCollection = client.db('bistroDB').collection('reviews');
        const cartCollection = client.db('bistroDB').collection('cart');
        const userCollection = client.db('bistroDB').collection('users');

        // JWT Related API
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        });

        // verification middle ware
        const verifyToken = (req, res, next) => {
            console.log('inside the verify Token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized Access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized Access' })
                }
                req.decoded = decoded;
                next();
            });

        }
        // verify admin after token
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            next();
        }

        // menu section
        // view all the menu Items
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result)
        });
        // view a single menu item
        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await menuCollection.findOne(query)
            res.send(result)
        });
        // add new menu item
        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            const result = await menuCollection.insertOne(item);
            res.send(result)
        });
        // delete menu item
        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await menuCollection.deleteOne(query)
            res.send(result)
        });
        // Update menu item
        app.patch('/menu/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    recipe: item.recipe,
                    image: item.image
                }
            }

            const result = await menuCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        // Review section
        // view all review items
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result)
        });

        // cart section
        // view all cart item
        app.get('/cart', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await cartCollection.find(query).toArray();
            res.send(result)
        });
        // delete cart
        app.delete('/cart/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            res.send(result)
        });
        // Add a new cart
        app.post('/cart', async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollection.insertOne(cartItem)
            res.send(result)
        });

        // users section
        // view all users
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        });
        // view a single users
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }

            const query = { email: email }
            const user = await userCollection.findOne(query)
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })
        });
        // Add a new user
        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user does not exist.
            // you can do tis many ways (1. email unique, 2 upsert, 3. simple checking)
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        });
        // delete users
        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        });
        // Update user
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin',
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Boss is Running')
})
app.listen(port, () => {
    console.log(`Bistro Boss Server is Running On Port ${port}`);
})
