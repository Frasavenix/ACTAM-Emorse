import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const apiKey = '';
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors());

app.post("/", async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "'prompt' field is mandatory." });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: "user", content: prompt },
                {
                    role: "system", content: "You are an emotionally-intelligent and empathetic agent. "
                        + "You will be given a piece of text, and your task is to identify all the emotions expressed by the writer of the text. "
                        + "The text could be in different languages. You are only allowed to make selections from the following emotions, "
                        + "and don’t use any other words: [joy, sadness, wonder, transcendence, nostalgia/longing, tenderness, anger, tension, disgust, hilarity, mystery, non-sense]. "
                        + "Only select those ones for which you are reasonably confident that they are expressed in the text. "
                        + "If no emotion is clearly expressed, select ‘neutral’. You are asked to also identify the arousal level of the text, "
                        + "with a value which goes from 0 (calmness) to 1 (complete arousal). Reply with only the list of emotions (plus the arousal) in form of a JSON array, "
                        + "separated by comma and with an associated accuracy value (which goes from 0 to 1). The sum of all the accuracies (without considering the arousal level) must be 1."
                        + "\nYou are also a precise ambience observer. You have to identify if the text given to you has an ambience "
                        + "description which suits one of the following words: [rain, wind, sea, beach, city, mountain, forest]. "
                        + "Don't use any other words. If the text does not suit any of these words, select ‘none’."
                        + "For example purposes, here's how the output should look like:"
                        + "\n{ 'emotions': [ {'emotion': 'sadness', 'accuracy': 0.8}, {'emotion': 'anxiety', 'accuracy': 0.15}, {'emotion': 'anger', 'accuracy': 0.05} ], 'arousal': 0.67, 'ambience': 'sea'}"
                }
                ],
                max_tokens: 100,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `OpenAI's API error: ${response.statusText}` });
        }

        const data = await response.json();
        console.log(data.choices[0].text);
        res = data.choices[0].text;
    } catch (error) {
        console.error("Error during the API request:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

app.listen(port, () => {
    console.log("Listening at http://localhost:" + port);
});
