const MongoClient = require("mongodb").MongoClient;
const axios = require("axios");

const mongoURI = "mongodb://localhost:27017/";
const dbName = "drinks";

async function insertData() {
  const client = new MongoClient(mongoURI, { useUnifiedTopology: true });

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(dbName);

    const ingredientApi =
      "https://www.thecocktaildb.com/api/json/v1/1/list.php?i=list";
    const cocktailApi =
      "https://www.thecocktaildb.com/api/json/v1/1/search.php?s=";

    const responseIngredient = await axios.get(ingredientApi);
    const ingredients = responseIngredient.data.drinks;

    const responseCocktail = await axios.get(cocktailApi);
    const cocktails = responseCocktail.data.drinks;

    const ingredientCollection = db.collection("ingredients");
    const cocktailCollection = db.collection("cocktails");

    await ingredientCollection.insertMany(ingredients);

    await cocktailCollection.insertMany(cocktails);

    console.log("Data inserted successfully");
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

insertData();
