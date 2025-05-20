const express = require('express');
const { MongoClient } = require("mongodb");
const axios = require('axios');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uri = `mongodb+srv://yakiniA:${encodeURIComponent(process.env.mongoPwd)}@cluster0.0cptoxi.mongodb.net/?retryWrites=true&w=majority`;
const openai_key = process.env.AIAPIKEY; 


async function openaiEmbedding(query) {
  const url = 'https://api.openai.com/v1/embeddings';
  const response = await axios.post(url, {
    input: query,
    model: "text-embedding-ada-002"
  }, {
    headers: {
      'Authorization': `Bearer ${openai_key}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.status === 200) {
    return response.data.data[0].embedding;
  } else {
    throw new Error(`Failed to get embedding with code: ${response.status}`);
  }
}


app.post("/vectorSearch_input", async (req, res) => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("Vector");

    const { title, content } = req.body;
    const text = `${title} ${content}`; 

    const embedding = await openaiEmbedding(text);

    const input = {
      title,
      content,
      embedding
    };

    const result = await db.collection("VectorSearch").insertOne(input);
    res.json({ insertedId: result.insertedId });

  } catch (err) {
    console.error("Error in POST /vectorSearch_input:", err);
    res.status(500).send("Error inserting document");
  }
});

app.post("/vectorSearch", async (req, res) => {
  try {
    const queryText = `${req.body.title} ${req.body.content}`

    const embedding = await openaiEmbedding(queryText);

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("Vector");

    const documents = await db.collection("VectorSearch").aggregate([
      {
        $search: {
          index: "vectorIndex", 
          knnBeta: {
            vector: embedding,
            path: "embedding",
            k: 5
          }
        }
      },
      { $unset: "embedding" }
    ]).toArray();

    res.json(documents);

  } catch (err) {
    console.error("Error in POST /vectorSearch:", err);
    res.status(500).send("Error searching documents");
  }
});

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`Listening to port ${port}`);
});
