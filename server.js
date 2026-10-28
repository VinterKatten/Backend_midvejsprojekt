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

app.get('/pokemon/type',(req, res)=>{
    const TypePokemon = req.query.type;

    db.query('select * from pokemon where primary_type = ?', [TypePokemon])
        .then(([results]) => {
            res.json(results);
        })
});

app.get('/pokemon/minATK',(req, res)=>{
    const minAttack = req.query.attack;

    db.query('select * from pokemon where attack > ?', [minAttack])
        .then(([results]) => {
            res.json(results);
        })
});

app.get('/pokemon/name',(req, res)=>{
    const Characters = req.query.char;
    const searchValue = '%' + Characters + '%';

    db.query('select * from pokemon where name like ?', [searchValue])
        .then(([results]) => {
            res.json(results);
        })
});

app.get('/trainer', (req, res) => {
    db.query('SELECT * FROM trainer')
        .then(([rows]) => {
            res.json(rows);
        })
});

app.get('/trainer/pokemon', (req, res) => {
    const RequestedTrainer = req.query.trainer;
    db.query(`SELECT p.pokedex_number, p.name, p.primary_type, p.secondary_type
                FROM trainer t
                JOIN trainer_pokemon tp ON t.trainer_id = tp.trainer_id
                JOIN pokemon p ON tp.pokedex_number = p.pokedex_number
                WHERE t.trainer_name = ?`,[RequestedTrainer])
        .then(([rows]) => {
            res.json(rows);
        })
});



app.listen(3000, () => {
    console.log('API kører på http://localhost:3000');
});