import type { WatchItem } from "./types.ts";

import express from "express";

var app = express();
//app.use(bodyParser.json());
app.set('view engine', 'pug');
app.use(express.static('./public'));

//index
app.get("/", async (req, res) => {
    const response = await fetch('http://localhost:3000/api/jobs');
    const data = await response.json();
    res.render("index", {
        data: data
    });
});

app.listen(3080, () => console.log("Server läuft auf http://localhost:3080"));