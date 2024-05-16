const express = require('express');
const app = express();

const expressWs = require('express-ws')(app);

const fetch = require('node-fetch');

// HTTP GET endpoint
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const BASE_URL = 'https://pokeapi.co/api/v2/pokemon'

async function getAllPokemonNames(number=151) {
    if(!isFinite(number)) {
        number = 151
    }
    const url = `${BASE_URL}?limit=${number}`
    const response = await fetch(url)
    const json = await response.json()

    // beware: results is just a field in the JSON response
    return json.results
}

app.get('/pokemon', async (req, res) => {

    // first version: send back pokemon by calling
    // function without parameter
    //const pokemonNames = await getAllPokemonNames()

    // second version: make use of query parameters
    // req object contains it
    const limit = req.query.limit;
    if(limit && !isFinite(limit)) {
        res.sendStatus(500)
        return;
    }
    const pokemonNames = await getAllPokemonNames(limit)

    res.send(pokemonNames)
})


/**
 * In memory storage of all Pokemon names
 */

const PARTICIPANT_COUNT = 10;
let pokemonNames = [] 
async function startup() {
    pokemonNames = await getAllPokemonNames(PARTICIPANT_COUNT);
}
// this is a bit hacky but will do for the live demo
startup()

let connections = []

// WebSocket endpoint
app.ws('/websocket', (ws, req) => {

    connections.push(ws);
    let currentPokemon;

    ws.on('message', (message) => {
        console.log('Received message:', message);

        try {
            const actionMessage = JSON.parse(message);
            if(actionMessage.type == "join") {
                // we are currently not dealing with the
                // case when there are no more pokemon names
                currentPokemon = pokemonNames.pop();
                ws.send(JSON.stringify({
                    type: "displayName",
                    name: currentPokemon.name
                }));
                broadcast(JSON.stringify({ type: "newUser", name: currentPokemon.name }))
                return;
            }
            if(actionMessage.type == "chat") {
                broadcast(JSON.stringify({type: "chat", name: currentPokemon.name, message: actionMessage.message}))
                return;
            }

        } catch (error) {
            console.error('Failed to parse message as JSON:', error);
            ws.send("Message not correctly formatted")
        }
    });

    ws.on('close', () => {
        console.log('WebSocket closed');
        // Perform any necessary cleanup or handling here
        
        // broadcast that user has left
        broadcast(JSON.stringify({ type: "userLeft", name: currentPokemon.name }))

        // Push pokemon back to the list of available pokemon for chat names
        pokemonNames.push(currentPokemon);

        // Remove the connection from the list of connections
        connections = connections.filter(conn => conn !== ws);
    });
});

//implicit global parameter `connections`
function broadcast(message) {
    connections.forEach(conn_ws => { 
        conn_ws.send(message)
    });
}


// Start the server
const port = 3000;
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});