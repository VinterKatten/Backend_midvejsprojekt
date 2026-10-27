const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 + 1 AS result');
        res.json({ status: 'ok', db: rows[0].result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/pokemon', (req, res) => {
    db.query('SELECT * FROM pokemon')
        .then(([rows]) => {
            res.json(rows);
        })
});

app.get('/filter/type',(req, res)=>{
    const TypePokemon = req.query.type;

    db.query('select * from pokemon where primary_type = ?', [TypePokemon])
        .then(([results]) => {
            res.json(results);
        })
});

app.get('/filter/minATK',(req, res)=>{
    const minAttack = req.query.attack;

    db.query('select * from pokemon where attack > ?', [minAttack])
        .then(([results]) => {
            res.json(results);
        })
});

app.get('/filter/name',(req, res)=>{
    const Characters = req.query.char;
    const searchValue = '%' + Characters + '%';

    db.query('select * from pokemon where name like ?', [searchValue])
        .then(([results]) => {
            res.json(results);
        })
});


app.listen(3000, () => {
    console.log('API kører på http://localhost:3000');
});