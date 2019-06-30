const express = require("express");
const cors = require("cors");
const commander = require("commander");

const db = require("./apis/db");
const ned = require("./apis/ned");
// const deedHandler = require("./deed-handler");
const energyHandler = require("./energy-handler");

const web3Helper = require("../helpers/web3");
const contractHelper = require("../helpers/contract");

const serverConfig = require("../household-server-config");

// Specify cli options
commander
  .option("-h, --host <type>", "ip of household server")
  .option("-p, --port <type>", "port of household server")
  .option("-d, --dbUrl <type>", "url of mongodb")
  .option("-N, --nedUrl <type>", "url of NED server")
  .option("-a, --address <type>", "address of the parity account")
  .option("-P, --password <type>", "password of the parity account")
  .option(
    "-n, --network <type>",
    "network name specified in truffle-config.js"
  );
commander.parse(process.argv);

// Configuration wrapper
const config = {
  host: commander.host || serverConfig.host,
  port: commander.port || serverConfig.port,
  dbUrl: commander.dbUrl || serverConfig.dbUrl,
  nedUrl: commander.nedUrl || serverConfig.nedUrl,
  network: commander.network || serverConfig.network,
  address: commander.address || serverConfig.address,
  password: commander.password || serverConfig.password,
  dbName: serverConfig.dbName,
  sensorDataCollection: serverConfig.sensorDataCollection,
  utilityDataCollection: serverConfig.utilityDataCollection
};

// Set up the DB
db.createDB(config.dbUrl, config.dbName, [
  config.sensorDataCollection,
  config.utilityDataCollection
]).catch(err => {
  console.log("Error while creating DB", err);
});

let web3;
let utilityContract;
// let utilityEventListener;

// Boolean flag whether the netting is currently active or not. If true no transaction must be send!
let nettingActive = false;

async function init() {
  // Set up the DB
  db.createDB(config.dbUrl, config.dbName, [
    config.sensorDataCollection,
    config.utilityDataCollection
  ]).catch(err => {
    console.log("Error while creating DB", err);
  });

  // Set up web3
  const web3 = web3Helper.initWeb3(config.network);
  utilityContract = new web3.eth.Contract(
    contractHelper.getAbi("utility"),
    contractHelper.getDeployedAddress("utility", await web3.eth.net.getId())
  );

  // Set up the event Listener on the dUtility contract to control the data flow until the netting was successful
  // TODO Rename Event to actual name from the dUtility contract
  utilityContract.events.NettingSuccessful(
    { filter: {}, fromBlock: 0 },
    ((error, event) => {
      console.log(error, event);
    })
      // Listener on data. Fires on each incoming event with the event object as argument.
      .on("data", event => {
        console.log("Netting successful event received");
        nettingActive = false;
      })

      // Listener on changed. Fires on each event which was removed from the blockchain.
      // The event will have the additional property "removed: true".
      .on("changed", event => console.error(event))

      // Listener on error. Fires when an error in the subscription occurs.
      .on("error", err => console.error(err))
  );

  // Set up the event Listener on the dUtility in case the netting process starts
  // TODO Rename Event to actual name from the dUtility contract
  utilityContract.events.StartNetting(
    { filter: {}, fromBlock: 0 },
    ((error, event) => {
      console.log(error, event);
    })
      // Listener on data. Fires on each incoming event with the event object as argument.
      .on("data", event => {
        console.log("Netting starts now. Setting flag nettingActive on true");
        nettingActive = true;
      })

      // Listener on changed. Fires on each event which was removed from the blockchain.
      // The event will have the additional property "removed: true".
      .on("changed", event => console.error(event))

      // Listener on error. Fires when an error in the subscription occurs.
      .on("error", err => console.error(err))
  );
}

init();

/**
 * Creating the express server waiting for incoming requests
 * When a request comes in, a corresponding event is emitted
 * At last a response is sent to the requester
 */
const app = express();

app.use(express.json());
app.use(cors());

/**
 * GET /sensor-stats?from=<fromDate>&to=<toDate>
 */
app.get("/sensor-stats", async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromQuery = from ? { timestamp: { $gte: parseInt(from) } } : {};
    const toQuery = to ? { timestamp: { $lte: parseInt(to) } } : {};
    const data = await db.readAll(
      config.dbUrl,
      config.dbName,
      config.sensorDataCollection,
      {
        ...fromQuery,
        ...toQuery
      }
    );
    res.setHeader("Content-Type", "application/json");
    res.status(200);
    res.end(JSON.stringify(data));
  } catch (error) {
    console.log(error);
    res.status(500);
    res.end(error);
  }
});

/**
 * GET /deeds?from=<fromDate>&to=<toDate>
 */
app.get("/deeds", async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromQuery = from ? { timestamp: { $gte: parseInt(from) } } : {};
    const toQuery = to ? { timestamp: { $lte: parseInt(to) } } : {};
    const data = await db.readAll(
      config.dbUrl,
      config.dbName,
      config.utilityDataCollection,
      {
        ...fromQuery,
        ...toQuery
      }
    );
    res.setHeader("Content-Type", "application/json");
    res.status(200);
    res.end(JSON.stringify(data));
  } catch (error) {
    console.log(error);
    res.status(500);
    res.end(error);
  }
});

/**
 * GET /household-stats
 */
app.get("/household-stats", async (req, res, next) => {
  try {
    const data = await ned.getHousehold(config.nedUrl, config.address);
    res.setHeader("Content-Type", "application/json");
    res.status(200);
    res.end(JSON.stringify(data));
  } catch (error) {
    console.log(error);
    res.status(500);
    res.end(error);
  }
});

/**
 * GET /network-stats
 */
app.get("/network-stats", async (req, res, next) => {
  try {
    const data = await ned.getNetwork(config.nedUrl, config.address);
    res.setHeader("Content-Type", "application/json");
    res.status(200);
    res.end(JSON.stringify(data));
  } catch (error) {
    console.log(error);
    res.status(500);
    res.end(error);
  }
});

/**
 * PUT /sensor-stats
 */
app.put("/sensor-stats", async (req, res) => {
  const { produce, consume } = req.body;
  try {
    if (typeof produce !== "number" || typeof consume !== "number") {
      throw new Error("Invalid payload");
    }

    if (nettingActive) {
      throw new Error(
        "Netting process is still active. Not sending Transaction... "
      );
    }

    // TODO Error handling
    await Promise.all([
      energyHandler.putEnergy(config, web3, produce - consume),
      db.writeToDB(config.dbUrl, config.dbName, config.sensorDataCollection, {
        produce,
        consume
      })
    ]);
    res.status(200);
    res.send();
  } catch (err) {
    res.status = 400;
    res.send(err);
  }
});

/**
 * POST request not supported
 */
app.post("/", function(req, res, next) {
  res.statusCode = 400;
  res.end(
    req.method +
      " is not supported. Try GET for UI Requests or PUT for Sensor data!\n"
  );
});

/**
 * DELETE request not supported
 */
app.delete("/", function(req, res, next) {
  res.statusCode = 400;
  res.end(
    req.method +
      " is not supported. Try GET for UI Requests or PUT for Sensor data\n"
  );
});

/**
 * Let the server listen to incoming requests on the given IP:Port
 */
app.listen(config.port, () => {
  console.log(
    `Household Server running at http://${config.host}:${config.port}/`
  );
});
