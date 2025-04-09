const express = require("express");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const OpenAI = require("openai");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractTextFromFile(file) {
  if (file.mimetype === "application/pdf") {
    const dataBuffer = fs.readFileSync(file.path);
    const parsed = await pdfParse(dataBuffer);
    return parsed.text;
  } else if (
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.mimetype === "application/msword"
  ) {
    const data = fs.readFileSync(file.path);
    const result = await mammoth.extractRawText({ buffer: data });
    return result.value;
  } else {
    throw new Error("Unsupported file type.");
  }
}

app.post("/api/match-score", upload.single("cvFile"), async (req, res) => {
  const jobText = req.body.jobText;
  const file = req.file;

  if (!file || !jobText) {
    return res.status(400).json({ error: "Missing file or job description." });
  }

  try {
    const resumeText = await extractTextFromFile(file);

    const prompt = `חשב אך ורק את אחוז ההתאמה בין קורות החיים הבאים:
${resumeText}

לבין תיאור המשרה הבא:
${jobText}

החזר אחוז בלבד.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    res.json({ result: response.choices[0].message.content });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error." });
  } finally {
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
});

app.post("/api/missing-keywords", upload.single("cvFile"), async (req, res) => {
  const jobText = req.body.jobText;
  const file = req.file;

  if (!file || !jobText) {
    return res.status(400).json({ error: "Missing file or job description." });
  }

  try {
    const resumeText = await extractTextFromFile(file);

    const prompt = `מצא את מילות המפתח החשובות בתיאור המשרה הבא:
${jobText}

והשווה אותן לקורות החיים הבאים:
${resumeText}

החזר רשימה של מילות מפתח שלא מופיעות בקורות החיים.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    res.json({ result: response.choices[0].message.content });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error." });
  } finally {
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
});

app.listen(port, () => {
  console.log(`API V2 running on http://localhost:${port}`);
});