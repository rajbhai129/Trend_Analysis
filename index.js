import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const app = express();
// ...existing code...
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ...existing code...
const port = process.env.PORT || 3000;

// Serve static files (for example, CSS)
app.use(express.static('public'));

// Body parser to handle form submission
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// EJS template engine setup
app.set("view engine", "ejs");
app.set("views", "views");

// Temporary global storage for trends data
let resultsData = [];

// Root route: Render the index page
app.get("/", (req, res) => {
    res.render("index", { trendsData: null, error: null, queries: null });
});
app.get("/features",(req,res)=>
{
   res.render("features");
});
app.get("/about",(req,res)=>
{
    res.render("about.ejs");
})
// Fetch trends data and render the trends page
app.post("/getTrends", async (req, res) => {
    const queries = req.body.queries;
    const apiKey = process.env.SERPAPI_API_KEY;
    const apiUrl = `https://serpapi.com/search.json?engine=google_trends&q=${queries}&api_key=${apiKey}`;

    try {
        const response = await axios.get(apiUrl);
        const trendData = response.data.interest_over_time.timeline_data;

        const formattedData = trendData.map(entry => ({
            date: entry.date,
            values: entry.values.map(val => ({
                query: val.query,
                value: parseInt(val.extracted_value, 10)
            })),
            trendWinner: entry.values.reduce((max, val) =>
                parseInt(val.extracted_value, 10) > parseInt(max.extracted_value, 10) ? val : max
            ).query
        }));

        resultsData = formattedData; // Store for CSV download
        res.render("trends", { trendsData: formattedData, error: null, queries });
    } catch (error) {
        console.error(error);
        resultsData = []; // Clear the stored results on failure
        res.render("index", { trendsData: null, error: "Failed to fetch data. Please try again later.", queries });
    }
});

// Function to generate CSV content
function generateCSV(data) {
    let csv = 'Date,Query,Value,Trend Winner\n';
    data.forEach(row => {
        const { date, values, trendWinner } = row;
        values.forEach(val => {
            csv += `${date},${val.query},${val.value},${trendWinner}\n`;
        });
    });
    return csv;
}

// Add route to download CSV
app.get('/download-csv', (req, res) => {
    if (!resultsData || resultsData.length === 0) {
        return res.status(400).send('No results available to download.');
    }

    const csv = generateCSV(resultsData);
    const filePath = path.join(__dirname, 'trends_results.csv');
    
    fs.writeFileSync(filePath, csv); // Save CSV file locally

    res.download(filePath, 'trends_results.csv', (err) => {
        if (err) {
            console.error('Error while downloading CSV:', err);
        }
        fs.unlinkSync(filePath); // Delete file after sending to the user
    });
});

// Start the server 
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
