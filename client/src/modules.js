const fs = require("node:fs");

const io = require("socket.io-client");
let socket;

const multer = require("multer");
const path = require("path");

const downloadDirectory = path.join(__dirname, "download");
if (!fs.existsSync(downloadDirectory)) {
	fs.mkdirSync(downloadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, downloadDirectory);
	},
	filename: function (req, file, cb) {
		cb(null, file.originalname);
	},
});

const upload = multer({ storage: storage });

let isConnected = false;

function updateConnection(status) {
	isConnected = status;
}

function getConnection() {
	console.log(`isConnected: ${isConnected}`);
	return isConnected;
}

async function initSocket(rl) {
	socket = io("http://localhost:1337");

	process.on("uncaughtException", function (exception) {
		console.log(exception);
	});

	socket.on("clientAccepted", async (data) => {
		console.clear();
		isConnected = true;
		displayMenu();

		isInDB = true;

		console.log("\tYour request has been accepted");

		let appsList;
		let osPlatform;
		let osRelease;
		let IP;
		let geolocation;

		let recievedID = data.requested_computer_id;
		let myID = getSetUUID();

		if (myID === recievedID) {
			appsList = await getApps();
			const osInfo = await getOsInfo();
			osPlatform = osInfo.osPlatform;
			osRelease = osInfo.osRelease;
			IP = await getIP();
			geolocation = "Karlskrona, Blekinge Lan (SE)";
			//? IP-based geolocation API's require payment, and i'm broke.

			socket.emit("My Information:", {
				uuid: myID,
				apps: appsList,
				osPlatform: osPlatform,
				osRelease: osRelease,
				ip: IP,
				geolocation: geolocation,
			});
		}
	});

	socket.on("REJECTED", async (data) => {
		let myID = getSetUUID();

		if (data.uuid === myID) {
			console.log("Your watchlist request was rejected.");
			updateConnection(false);
		}
	});

	socket.on("File Server to Client", async (data) => {
		console.log("File received from server:");
		saveReceivedFile(data.file);
	});
	let uuid = getSetUUID();
	socket.emit("I AM ONLINE", { uuid: uuid });

	isInDB().then((inDB) => {
		if (inDB) {
			startHeartbeat(); // Start heartbeat if in DB
			isConnected = true;
			displayMenu();
		}

		// displayMenu(rl);
	});

	socket.on("ACCEPTED REMOVED FROM DATABASE", (data) => {
		if (uuid === data.uuid) {
			console.clear();
			updateConnection(false);
			isInDB = false;
			stopHeartbeat();
			offline();
			console.log("You have been removed from the database.");
			process.exit(0);
		}
	});
}

function saveReceivedFile(file) {
	const fs = require("fs");
	const filePath = path.join(downloadDirectory, file.name);

	fs.copyFile(file.path, filePath, (err) => {
		if (err) {
			console.error("Error saving file:", err);
		} else {
			console.log(`File saved successfully to: ${filePath}`);
		}
	});
}
const heartbeats = require("heartbeats");
const fetchSoft = require("fetch-installed-software");
const os = require("node:os");

let osName;
(async () => {
	osName = (await import("os-name")).default;
})();

const ip = require("ip");
const { table } = require("node:console");

let serverStatus;

async function displayMenu() {
	console.clear();
	console.log("=".repeat(process.stdout.columns));
	console.log(`
        +============================+
        ||  C2 Security Application ||
        +============================+
    `);

	if (!socket || !socket.connected) {
		console.log("\n\t* Server is Offline\n");
		console.log(`
||\t1. Terminate                            >Terminate events before turning off
||\t2. Add To Watchlist                     >Ask to be added to watchlist
        `);
	} else {
		console.log("\n\t* Server is Online\n");

		try {
			const pending = await isPending(); // Await the promise
			if (pending) {
				console.log(`
||\t1. Terminate                            >Terminate events before turning off
||\t2. Add To Watchlist                     >Ask to be added to watchlist
                `);
			} else if (!isConnected) {
				console.log(`
||\t1. Terminate                            >Terminate events before turning off
||\t2. Start Heartbeat Connection           >Start heartbeat
||\t3. Enumerate                            >Enumerate sent information
||\t4. Run in background                    >CTRL + SHIFT + ALT + Q: show window
||\t5. Send file to server                  >Enter filepath to file to send
                `);
			} else {
				console.log(`
||\t1. Terminate                            >Terminate events before turning off
||\t2. Start Heartbeat Connection           >Start heartbeat
||\t3. Enumerate                            >Enumerate sent information
||\t4. Run in background                    >CTRL + SHIFT + ALT + Q: show window
||\t5. Send file to server                  >Enter filepath to file to send
                `);
			}
		} catch (error) {
			console.error("Error checking pending status:", error);
		}
	}
	console.log("=".repeat(process.stdout.columns));
}

async function atw(timeoutID) {
	return new Promise((resolve, reject) => {
		const uuid = getSetUUID();

		socket.emit("ATW", { uuid: uuid });

		socket.on("ATW_res", (data) => {
			clearTimeout(timeoutID);
			messageData = data.message;
			resolve(data.message);
		});

		socket.on("error", (err) => {
			reject(new Error(`Socket error: ${err.message}`));
		});
	});
}

async function enumer() {
	const { table } = require("table");
	let uuid = getSetUUID();
	socket.emit("Give My Information", { uuid: uuid });

	socket.on("Heres Your Info", (data) => {
		const cyan = "\x1b[36m";
		const reset = "\x1b[0m";
		if (uuid === data.uuid) {
			console.log(`
				${cyan}UUID:${reset} ${data.uuid}
				${cyan}OS Type:${reset} ${data.os_name}
				${cyan}OS Version:${reset} ${data.os_ver}
				${cyan}Location:${reset} ${data.location}
				${cyan}IP Address:${reset} ${data.ip_adress}
				Installed apps:
				`);

			const apps = data.apps;

			function chunkArray(array, chunkSize) {
				const result = [];
				for (let i = 0; i < array.length; i += chunkSize) {
					result.push(array.slice(i, i + chunkSize));
				}
				const lastRow = result[result.length - 1];
				while (lastRow.length < chunkSize) {
					lastRow.push("");
				}

				return result;
			}

			const appsTable = chunkArray(apps, 3);

			console.log(table(appsTable));
		}
	});
}

async function getApps() {
	const appList = fetchSoft.getAllInstalledSoftwareSync();

	//? COMMENT TO SHOW FILTER
	const windowsFilter = appList.filter(
		(app) => !/\{.*\}/.test(app.RegistryDirName)
	);

	const appArray = [];

	//? AND CHANGE WINDOWSFILTER TO APPLIST
	windowsFilter.forEach((app) => {
		if (app.RegistryDirName) {
			appArray.push(app.RegistryDirName);
		}
	});

	return appArray;

	// socket.emit("appList", appArray);

	// console.log(fetchSoft.getAllInstalledSoftwareSync());
}

//!
//! VISUAL BUG WITH "SERVER IS ONLINE/OFFLINE"
//! MOST LIKELY DUE TO TWO DIFFERENT MOMENTS
//! COLLIDING LEADING TO RANDOM BETWEEN ON/OFF
//!

let heart;
let heartbeatActive = false;
let previousServerStatus = null;
let beatTimeout;

async function startHeartbeat() {
	if (heartbeatActive) {
		console.log("Heartbeat is already running.");
		return;
	}

	console.log("Heartbeat started");
	heartbeatActive = true;

	heart = heartbeats.createHeart(5000); // Heartbeat every 5 seconds
	let failedBeats = 0;

	socket.on("server_status", (data) => {
		serverStatus = data.status === "online"; // Update serverStatus based on server response
		if (serverStatus) {
			if (!isConnected) {
				isConnected = true; // Set connected status
				displayMenu(); // Update the menu when server is online
			}
		} else {
			isConnected = false; // Update connection status
			displayMenu(); // Update the menu when server is offline
		}
		resetBeatTimeout();
	});

	heart.createEvent(1, function () {
		if (socket.connected) {
			socket.emit("beat"); // Send a heartbeat
		} else {
			isConnected = false; // Update connection status
			displayMenu(); // Call displayMenu to refresh the menu
		}
		resetBeatTimeout();
	});

	function resetBeatTimeout() {
		clearTimeout(beatTimeout);
		beatTimeout = setTimeout(() => {
			failedBeats++;
			console.log(`Missed heartbeat: ${failedBeats}`);
			if (failedBeats >= 2) {
				serverStatus = false;
				if (isConnected) {
					isConnected = false; // Update connection status
					displayMenu(); // Update the menu when server is offline
				}
			}
		}, 6000);
	}
}

function stopHeartbeat() {
	if (heart) {
		heart.kill(); // Stop the heartbeat
		heartbeatActive = false; // Reset the flag
	}
}

function getSetUUID() {
	let ID;

	try {
		ID = fs.readFileSync("./uuid.txt", "utf-8");
	} catch (err) {
		const { v4: uuidv4 } = require("uuid");
		const generatedID = uuidv4();

		fs.writeFileSync("./uuid.txt", generatedID);

		ID = generatedID;
	}

	return ID;
}

function getOsInfo() {
	const osPlatform = osName(os.platform());
	const osRelease = osName(os.release());

	return { osPlatform, osRelease };
}

function getIP() {
	const localIP = ip.address();
	return localIP;
}

async function isInDB() {
	return new Promise((resolve, reject) => {
		if (!socket || !socket.connected) {
			socket = io("http://localhost:1337");
		}
		const uuid = getSetUUID();

		socket.emit("Am I Connected?", { uuid: uuid });

		socket.on("You are:", (data) => {
			if (data.message === "yes") {
				resolve(true);
			} else {
				resolve(false);
			}
		});

		socket.on("error", (err) => {
			reject(new Error(`Socket error: ${err.message}`));
		});
	});
}

async function isPending() {
	return new Promise((resolve, reject) => {
		if (!socket || !socket.connected) {
			socket = io("http://localhost:1337");
		}
		const uuid = getSetUUID();

		socket.emit("Am I Pending?", { uuid: uuid });

		socket.on("You areP:", (data) => {
			if (data.message === "yes") {
				resolve(true);
			} else {
				resolve(false);
			}
		});

		socket.on("error", (err) => {
			reject(new Error(`Socket error: ${err.message}`));
		});
	});
}

async function sendFile(filepath) {
	try {
		const fileData = fs.readFileSync(filepath);
		const fileName = path.basename(filepath);

		socket.emit("Sending File", {
			name: fileName,
			data: fileData,
		});
		console.log(`File ${fileName} sent successfully.`);
	} catch (error) {
		console.log("Incorrect path. Check filename or path and try again.");
	}
}

async function offline() {
	let uuid = getSetUUID();
	socket.emit("I AM OFFLINE", { uuid: uuid });

	if (socket) {
		stopHeartbeat();
		socket.removeAllListeners();
		socket.disconnect();
		console.log("Events terminated. You can now turn off the window.");
		// await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	// Remove all listeners to ensure clean exit
	process.removeAllListeners("SIGINT");
	process.removeAllListeners("uncaughtException");
}

module.exports = {
	atw,
	startHeartbeat,
	getSetUUID,
	getOsInfo,
	getIP,
	enumer,
	isInDB,
	isPending,
	updateConnection,
	sendFile,
	initSocket,
	offline,
	displayMenu,
	getConnection,
};
