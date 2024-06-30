import express, { json, urlencoded } from "express";
import { join } from "path";
import pkg from "mongoose";
/* import { connect, model, Schema } from "mongoose"; */
import { config } from "dotenv";
/* import { products as _products, categories } from "./data.js"; */
import data from "./data.js";

import { fileURLToPath } from "url";
import { dirname } from "path";

//console.log("data", data);

const app = express();
const serveStatic = express.static;
const { connect, model, Schema } = pkg;
const { products: _products, categories } = data;

console.log("_products", _products);
console.log("categories", categories);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("dirname", __dirname);

app.use(json());
app.use(urlencoded({ extended: true }));

config();

connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true,
});

const Product = model(
  "products",
  new Schema({
    name: String,
    description: String,
    image: String,
    price: Number,
    calorie: Number,
    category: String,
  })
);

app.get("/api/products/seed", async (req, res) => {
  await Product.remove({});
  const products = await Product.insertMany(_products);
  res.send({ products });
});

app.get("/api/products", async (req, res) => {
  const { category } = req.query;
  const products = await Product.find(category ? { category } : {});
  res.send(products);
});

app.post("/api/products", async (req, res) => {
  const newProduct = new Product(req.body);
  const savedProduct = await newProduct.save();
  res.send(savedProduct);
});

app.get("/api/categories", (req, res) => {
  res.send(categories);
});

const Order = model(
  "Order",
  new Schema(
    {
      number: { type: Number, default: 0 },
      orderType: String,
      paymentType: String,
      isPaid: { type: Boolean, default: false },
      isReady: { type: Boolean, default: false },
      inProgress: { type: Boolean, default: true },
      isCanceled: { type: Boolean, default: false },
      isDelivered: { type: Boolean, default: false },
      itemsPrice: Number,
      taxPrice: Number,
      totalPrice: Number,
      orderItems: [
        {
          name: String,
          price: Number,
          quantity: Number,
        },
      ],
    },
    {
      timestamps: true,
    }
  )
);

app.get("/api/orders", async (req, res) => {
  const orders = await Order.find({ isDelivered: false, isCanceled: false });
  res.send(orders);
});

app.put("/api/orders/:id", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order) {
    if (req.body.action === "ready") {
      order.isReady = true;
      order.inProgress = false;
    } else if (req.body.action === "deliver") {
      order.isDelivered = true;
    } else if (req.body.action === "cancel") {
      order.isCanceled = true;
    }
    await order.save();

    res.send({ message: "Done" });
  } else {
    req.status(404).message({ message: "Order not found" });
  }
});
app.post("/api/orders", async (req, res) => {
  const lastOrder = await Order.find().sort({ number: -1 }).limit(1);
  const lastNumber = lastOrder.length === 0 ? 0 : lastOrder[0].number;
  if (
    !req.body.orderType ||
    !req.body.paymentType ||
    !req.body.orderItems ||
    req.body.orderItems.length === 0
  ) {
    return res.send({ message: "Data is required." });
  }
  const order = await Order({ ...req.body, number: lastNumber + 1 }).save();
  res.send(order);
});

app.get("/api/orders/queue", async (req, res) => {
  const inProgressOrders = await Order.find(
    { inProgress: true, isCanceled: false },
    "number"
  );
  const servingOrders = await Order.find(
    { isReady: true, isDelivered: false },
    "number"
  );

  res.send({ inProgressOrders, servingOrders });
});

app.use(serveStatic(join(__dirname, "/dist")));

app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "/dist/index.html"));
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`serve at http://localhost:${port}`);
});
