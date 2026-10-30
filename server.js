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

app.get("/pokemon/diffTypes", (req,res)=>{
    db.query('SELECT DISTINCT primary_type FROM pokemon')
        .then(([rows]) => {
        res.json(rows);
    })
})

app.get('/trainer', async (req, res, next) => {
    try {
        const [rows] = await db.query(`
            SELECT t.trainer_id, t.trainer_name, t.age, t.hometown,
                   COUNT(tp.pokedex_number) AS pokemon_count
            FROM trainer t
                     LEFT JOIN trainer_pokemon tp ON tp.trainer_id = t.trainer_id
            GROUP BY t.trainer_id, t.trainer_name, t.age, t.hometown
            ORDER BY t.trainer_name`);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

app.get('/trainer/pokemon', async (req, res, next) => {
    try {
        const trainerId = req.query.trainer_id;
        const trainerName = typeof req.query.trainer === 'string' ? req.query.trainer.trim() : '';

        let whereClause;
        let params;

        if (trainerId !== undefined && trainerId !== '') {
            const id = Number(trainerId);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ error: 'trainer_id must be a positive integer' });
            }
            whereClause = 'tp.trainer_id = ?';
            params = [id];
        } else if (trainerName) {
            // Backwards compatible: the old frontend used ?trainer=Ash
            whereClause = 't.trainer_name = ?';
            params = [trainerName];
        } else {
            return res.status(400).json({ error: 'trainer_id or trainer is required' });
        }

        const [rows] = await db.query(`
            SELECT p.pokedex_number, p.name, p.primary_type, p.secondary_type,
                   p.hp, p.attack, p.defence, p.special_attack,
                   p.special_defence, p.speed
            FROM trainer_pokemon tp
                     JOIN pokemon p ON tp.pokedex_number = p.pokedex_number
                     JOIN trainer t ON t.trainer_id = tp.trainer_id
            WHERE ${whereClause}
            ORDER BY p.pokedex_number`, params);

        res.json(rows);
    } catch (err) {
        next(err);
    }
});

app.post('/add_trainer', async (req, res, next) => {
    try {
        const body = req.body ?? {};
        const trainerName = typeof body.trainer_name === 'string' ? body.trainer_name.trim() : '';
        const hometown = typeof body.hometown === 'string' ? body.hometown.trim() : '';

        if (!trainerName) {
            return res.status(400).json({ error: 'trainer_name is required' });
        }
        if (trainerName.length > 50) {
            return res.status(400).json({ error: 'trainer_name must be 50 characters or fewer' });
        }
        if (hometown.length > 50) {
            return res.status(400).json({ error: 'hometown must be 50 characters or fewer' });
        }

        let age = null;
        const rawAge = typeof body.age === 'string' ? body.age.trim() : body.age;
        if (rawAge !== undefined && rawAge !== null && rawAge !== '') {
            age = Number(rawAge);
            if (!Number.isInteger(age) || age < 0 || age > 150) {
                return res.status(400).json({ error: 'age must be a whole number between 0 and 150' });
            }
        }

        const [existing] = await db.query(
            'SELECT trainer_id FROM trainer WHERE trainer_name = ?',
            [trainerName]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'A trainer with that name already exists' });
        }

        const [result] = await db.query(
            'INSERT INTO trainer (trainer_name, age, hometown) VALUES (?, ?, ?)',
            [trainerName, age, hometown || null]
        );

        res.status(201).json({
            trainer_id: result.insertId,
            trainer_name: trainerName,
            age: age,
            hometown: hometown || null
        });
    } catch (err) {
        next(err);
    }
});

app.post('/add_pokemonToTrainer', async (req, res, next) => {
    try {
        const body = req.body ?? {};
        const trainerIdRaw = body.trainer_id;
        const pokedexRaw = body.pokedex_number;
        const trainerNameRaw = typeof body.trainer_name === 'string' ? body.trainer_name.trim() : '';
        const pokemonNameRaw = typeof body.pokemon_name === 'string' ? body.pokemon_name.trim() : '';

        let trainer;
        if (trainerIdRaw !== undefined && trainerIdRaw !== null && trainerIdRaw !== '') {
            const trainerId = Number(trainerIdRaw);
            if (!Number.isInteger(trainerId) || trainerId <= 0) {
                return res.status(400).json({ error: 'trainer_id must be a positive integer' });
            }
            const [rows] = await db.query(
                'SELECT trainer_id, trainer_name FROM trainer WHERE trainer_id = ?',
                [trainerId]
            );
            trainer = rows[0];
            if (!trainer) {
                return res.status(404).json({ error: 'Trainer not found' });
            }
        } else if (trainerNameRaw) {
            // Backwards compatible: the old frontend sent trainer_name
            const [rows] = await db.query(
                'SELECT trainer_id, trainer_name FROM trainer WHERE trainer_name = ?',
                [trainerNameRaw]
            );
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Trainer not found' });
            }
            if (rows.length > 1) {
                return res.status(409).json({ error: 'Multiple trainers have that name; use trainer_id' });
            }
            trainer = rows[0];
        } else {
            return res.status(400).json({ error: 'trainer_id or trainer_name is required' });
        }

        let pokemon;
        if (pokedexRaw !== undefined && pokedexRaw !== null && pokedexRaw !== '') {
            const pokedexNumber = Number(pokedexRaw);
            if (!Number.isInteger(pokedexNumber) || pokedexNumber <= 0) {
                return res.status(400).json({ error: 'pokedex_number must be a positive integer' });
            }
            const [rows] = await db.query(
                'SELECT pokedex_number, name FROM pokemon WHERE pokedex_number = ?',
                [pokedexNumber]
            );
            pokemon = rows[0];
            if (!pokemon) {
                return res.status(404).json({ error: 'Pokémon not found' });
            }
        } else if (pokemonNameRaw) {
            const [rows] = await db.query(
                'SELECT pokedex_number, name FROM pokemon WHERE name = ?',
                [pokemonNameRaw]
            );
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Pokémon not found' });
            }
            if (rows.length > 1) {
                return res.status(409).json({ error: 'Multiple Pokémon have that name; use pokedex_number' });
            }
            pokemon = rows[0];
        } else {
            return res.status(400).json({ error: 'pokedex_number or pokemon_name is required' });
        }

        const [existing] = await db.query(
            'SELECT 1 FROM trainer_pokemon WHERE trainer_id = ? AND pokedex_number = ?',
            [trainer.trainer_id, pokemon.pokedex_number]
        );
        if (existing.length > 0) {
            return res.status(409).json({
                error: `${trainer.trainer_name} already has ${pokemon.name}`
            });
        }

        await db.query(
            'INSERT INTO trainer_pokemon (trainer_id, pokedex_number) VALUES (?, ?)',
            [trainer.trainer_id, pokemon.pokedex_number]
        );

        res.status(201).json({
            trainer_id: trainer.trainer_id,
            trainer_name: trainer.trainer_name,
            pokedex_number: pokemon.pokedex_number,
            pokemon_name: pokemon.name
        });
    } catch (err) {
        next(err);
    }
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

// Central error handler so a failed query returns JSON instead of killing the process.
app.use((err, req, res, next) => {
    console.error(err);

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'That record already exists' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ error: 'Referenced trainer or Pokémon does not exist' });
    }
    if (err.code === 'ER_DATA_TOO_LONG') {
        return res.status(400).json({ error: 'A value is too long' });
    }

    res.status(500).json({ error: 'Internal server error' });
});

app.listen(3000, () => {
    console.log('API kører på http://localhost:3000');
});

    
    


