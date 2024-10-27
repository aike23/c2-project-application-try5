"use strict";

const modules = require("./src/modules.js");
const { showConsole, hideConsole } = require("node-hide-console-window");
const iohook = require("iohook-raub");

const keyCodes = [29, 42, 56, 16];
const keyState = new Map(keyCodes.map((code) => [code, false]));

const handleShortcutDown = () => {
	// Check if all keys are pressed
	const allPressed = Array.from(keyState.values()).every(
		(state) => state === true
	);
	if (allPressed) {
		try {
			showConsole();
			iohook.stop();
		} catch (error) {}
	}
};

iohook.on("keydown", (event) => {
	if (keyCodes.includes(event.keycode)) {
		keyState.set(event.keycode, true); // Set key state to true when key is pressed
		handleShortcutDown();
	}
});

// Listener for keyup events to reset key state
iohook.on("keyup", (event) => {
	if (keyCodes.includes(event.keycode)) {
		keyState.set(event.keycode, false); // Reset key state to false when key is released
	}
});

let isInDB = false; // Set initial value

const readline = require("readline");
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

// Promisify rl.question to question
const util = require("util");

rl.question[util.promisify.custom] = (arg) => {
	return new Promise((resolve) => {
		rl.question(arg, resolve);
	});
};

rl.setPrompt(">>>");

(async function () {
	modules.initSocket(rl);

	await modules.displayMenu();

	// console.log(modules.getConnection());

	rl.prompt();

	rl.on("line", async function (input) {
		// console.log(`Received input: ${input}`);
		input = input.trim();
		let userArgument = input.split(" ");

		switch (userArgument[0]) {
			case "1":
				await modules.offline();
				process.exit();
				break;

			case "2":
				if (modules.getConnection()) {
					try {
						await modules.startHeartbeat(rl);
					} catch (error) {
						console.log(
							"Error while starting heartbeat:",
							error.message
						);
					} finally {
						modules.displayMenu();
					}
				} else {
					const pending = await modules.isPending();
					if (pending) {
						console.clear();
						modules.displayMenu();
						console.log("\tYour request is pending. Please wait.");
					} else {
						let timeoutID;
						try {
							let messageData = await Promise.race([
								new Promise((resolve, reject) => {
									timeoutID = setTimeout(() => {
										reject(
											new Error(
												"Request timeout: Server might be offline"
											)
										);
									}, 5000);
								}),
								modules.atw(timeoutID),
							]);
							modules.updateConnection(true);
							console.log(messageData);
							modules.displayMenu();
						} catch (error) {
							console.log(error.message);
							modules.displayMenu();
						}
					}
				}
				break;

			case "3":
				if (modules.getConnection()) {
					modules.enumer();
					modules.displayMenu();
				} else {
					modules.displayMenu();
					console.log("Not connected to server. Run ATW first.");
				}
				break;

			case "4":
				iohook.start();
				hideConsole();
				break;

			case "5":
				await modules.displayMenu();
				await modules.sendFile(userArgument[1]);
				break;

			default:
				modules.displayMenu();
				break;
		}

		process.on("SIGINT", () => {
			modules.offline();
			process.exit();
		});

		process.on("SIGTERM", () => {
			modules.offline();
			process.exit();
		});
	});
})();
