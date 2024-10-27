module.exports = function (io) {
	const express = require("express");
	const router = express.Router();
	require("dotenv").config();
	const mysql = require("promise-mysql");
	const multer = require("multer");
	const path = require("path");
	const fs = require("fs");

	const downloadDirectory = path.join(__dirname, "../download");
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

	const config = {
		host: process.env.DB_HOST,
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME,
		multipleStatements: true,
	};

	router.get("/", (req, res) => {
		let data = {
			title: "C2 Web Interface | Index",
		};

		res.render("index", data);
	});

	router.get("/pending", async (req, res) => {
		let data = {
			title: "C2 Web Interface | Pending",
		};

		const db = await mysql.createConnection(config);
		let sql = `SELECT requested_computer_id,
                date_requested
                FROM pending;`;

		let result = await db.query(sql);

		result.forEach((request) => {
			request.date_requested = new Date(
				request.date_requested
			).toLocaleString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			});
		});

		data.pendingRequests = result;
		// console.log(data.pendingRequests);

		res.render("pending", data);
	});

	router.post("/pending/allow", async (req, res) => {
		const id = req.body.requested_computer_id;
		const db = await mysql.createConnection(config);
		let result;

		try {
			const db = await mysql.createConnection(config);
			let sql = `CALL accepted_pending_request(?, @res);
                    SELECT @res AS result;`;
			result = await db.query(sql, [id]);

			io.emit("clientAccepted", { requested_computer_id: id });

			res.redirect("/pending");
		} catch (err) {
			console.error(err);
			res.status(500).send("Error processing request");
		} finally {
			db.end();
		}
	});

	router.post("/pending/remove", async (req, res) => {
		const id = req.body.requested_computer_id;
		const db = await mysql.createConnection(config);

		try {
			const db = await mysql.createConnection(config);
			let sql = `
            DELETE FROM pending
            WHERE requested_computer_id = ?;`;

			await db.query(sql, [id]);

			io.emit("REJECTED", { requested_computer_id: id });

			res.redirect("/pending");
		} catch (err) {
			console.error(err);
			res.status(500).send("Error processing request");
		} finally {
			db.end();
		}
	});

	router.get("/clients", async (req, res) => {
		let data = {
			title: "C2 Web Interface | Clients",
		};

		const db = await mysql.createConnection(config);
		let sql = `SELECT * FROM computer;`;

		let result = await db.query(sql);

		data.listOfClients = result;
		// console.log(data.listOfClients);

		res.render("clients", data);
	});

	router.post("/clients/apps", async (req, res) => {
		const computer_id = req.body.computer_id;
		let data = {
			title: "C2 Web Interface | List of Apps",
		};

		const db = await mysql.createConnection(config);
		let sql = `SELECT * FROM app WHERE computer_id = ?;`;
		let result = await db.query(sql, [computer_id]);

		data.apps = result;

		// console.log(data.apps);

		res.render("apps", data);
		db.end();
	});

	//! DOES NOT WORK!!!
	router.post("/clients/send", async (req, res) => {
		const computer_id = req.body.computer_id;
		let data = {
			title: "C2 Web Interface | Send apps",
		};

		const filePath = req.file.path;

		io.emit("File Server to Client", {
			requested_computer_id: computer_id,
			file: {
				name: req.file.originalname,
				path: filePath,
			},
		});

		res.render("apps", data);
		db.end();
	});

	router.post("/clients/remove", async (req, res) => {
		const computer_id = req.body.computer_id;
		let data = {
			title: "C2 Web Interface | Clients",
		};

		const db = await mysql.createConnection(config);
		let sql = `
		DELETE FROM computer
        WHERE computer_id = ?;
		`;

		await db.query(sql, [computer_id]);

		sql = `
		DELETE FROM app
        WHERE computer_id = ?;
		`;

		await db.query(sql, [computer_id]);

		io.emit("ACCEPTED REMOVED FROM DATABASE", { uuid: computer_id });

		sql = `SELECT * FROM computer;`;
		let result = await db.query(sql);
		data.listOfClients = result; // Update listOfClients

		res.render("clients", data);
		db.end();
	});

	router.get("/log", async (req, res) => {
		let data = {
			title: "C2 Web Interface | Log",
		};

		const db = await mysql.createConnection(config);
		let sql = `SELECT computer_id, status, date FROM log;`;

		let result = await db.query(sql);

		data.logs = result;
		// console.log(data.logs);

		res.render("log", data);
	});

	return router;
};
