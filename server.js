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
              WHERE t.trainer_name = ?`, [RequestedTrainer])
        .then(([rows]) => {
            res.json(rows);
        });
}); // <-- Denne manglede!

app.post('/add_trainer', (req, res) => {
    const trainerName = req.body.trainer_name;
    const age = req.body.age || null;              // <-- Denne manglede!
    const hometown = req.body.hometown || null;    // <-- Denne manglede!

    if (!trainerName) {
        return res.status(400).json({ error: 'trainer_name is required' });
    }

    db.query('INSERT INTO trainer (trainer_name, age, hometown) VALUES (?, ?, ?)', [trainerName, age, hometown])
        .then(([result]) => {
            res.json({
                trainer_id: result.insertId,
                trainer_name: trainerName,
                age: age,
                hometown: hometown
            });
        });
});

app.post('/add_pokemonToTrainer', (req, res) => {
    const trainerName = req.body.trainer_name;
    const pokemonName = req.body.pokemon_name;

    if (!trainerName || !pokemonName) {
        return res.status(400).json({ error: 'trainer_name and pokemon_name are required' });
    }

    db.query(`INSERT INTO trainer_pokemon (trainer_id, pokedex_number)
              SELECT t.trainer_id, p.pokedex_number
              FROM trainer t, pokemon p
              WHERE t.trainer_name = ? AND p.name = ?`, [trainerName, pokemonName])
        .then(([result]) => {
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Trainer or Pokemon not found' });
            }
            res.status(201).json({ trainer_name: trainerName, pokemon_name: pokemonName });
        });
});

app.get('/pokemon/avgAttackByType', (req, res) => {
    db.query(`SELECT RANK() OVER (ORDER BY AVG(attack) DESC) AS \`rank\`, primary_type,
                     ROUND(AVG(attack), 2) AS avg_attack
              FROM pokemon
              GROUP BY primary_type
              ORDER BY \`rank\``)
        .then(([rows]) => {
            res.json(rows);
        });
});


app.get('/pokemon/typeDistribution', (req, res) => {
    db.query(`SELECT primary_type, COUNT(*) AS total
               FROM pokemon
               GROUP BY primary_type
               ORDER BY total DESC`)
        .then(([rows]) => {
            res.json(rows);
        });
});

app.get('/pokemon/balancedStats', (req, res) => {
    db.query(`SELECT name, hp, attack, defence, 
             special_defence, special_attack, speed,
             GREATEST(hp, attack, defence,
                      special_attack, special_defence, speed)
             -
             LEAST (hp, attack, defence,
                      special_attack, special_defence, speed)
             AS stat_difference
        FROM pokemon
        WHERE hp IS NOT NULL
            AND attack IS NOT NULL
            AND defence IS NOT NULL
            AND special_attack IS NOT NULL
            AND special_defence IS NOT NULL
            AND speed IS NOT NULL
        ORDER BY stat_difference ASC
        LIMIT 20`)

    .then(([rows]) => {
        res.json(rows);
    });
});

app.listen(3000, () => {
    console.log('API kører på http://localhost:3000');
});

    
    


