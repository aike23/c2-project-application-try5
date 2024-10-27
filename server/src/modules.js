"use strict";

/*
    Primarily for database functionality
*/

require("dotenv").config();
const mysql = require("promise-mysql");

const config = {
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	multipleStatements: true,
};

async function addToPending(id) {
	const db = await mysql.createConnection(config);

	let sql = `
        CALL add_to_pending(?, @res);
        SELECT @res AS result;
    `;

	let result = await db.query(sql, [id]);
	await db.end();

	return result;
}

async function amIConnected(id) {
	// console.log(id);

	const db = await mysql.createConnection(config);

	let sql = `
        CALL am_i_connected(?, @res);
        SELECT @res AS result;
    `;

	let result = await db.query(sql, [id]);

	// console.log(result[1][0].result);

	await db.end();

	return result[1][0].result;
}

async function amIPending(id) {
	// console.log(id);

	const db = await mysql.createConnection(config);

	let sql = `
        CALL am_i_pending(?, @res);
        SELECT @res AS result;
    `;

	let result = await db.query(sql, [id]);

	// console.log(result[1][0].result);

	await db.end();

	return result[1][0].result;
}

async function recieveInfo(data) {
	const db = await mysql.createConnection(config);

	let sql = `
        CALL add_computer_info(?, ?, ?, ?, ?, @res);
    `;

	await db.query(sql, [
		data.uuid,
		data.osPlatform,
		data.osRelease,
		data.geolocation,
		data.ip,
	]);

	let apps = data.apps;
	let uuid = data.uuid;

	let values = apps.map((app) => [uuid, app]);

	sql = `
        INSERT INTO app (computer_id, applications)
		VALUES ?;
    `;

	await db.query(sql, [values]);

	await db.end();
}

async function iGiveYouYourInfo(id) {
	const db = await mysql.createConnection(config);

	let sql = `
        SELECT os_name, os_ver, location, ip_adress
        FROM computer
        WHERE computer_id = ?;
    `;

	const computerInfo = await db.query(sql, [id]);

	sql = `
	SELECT applications FROM app WHERE computer_id = ?;`;

	const listOfApps = await db.query(sql, [id]);

	let workingUUID = id;
	const result = {
		uuid: workingUUID,
		os_name: computerInfo[0].os_name,
		os_ver: computerInfo[0].os_ver,
		location: computerInfo[0].location,
		ip_adress: computerInfo[0].ip_adress,
		apps: listOfApps.map((row) => row.applications), 
	};

	await db.end();

	return result;
}

async function logOnline(id) {
	const db = await mysql.createConnection(config);

	let sql = `
        INSERT INTO log (computer_id, status)
        VALUES (?, ?);
    `;

	const values = [id, "online"];

	await db.query(sql, values);
	db.end();
}

async function logOffline(id) {
	const db = await mysql.createConnection(config);

	let sql = `
        INSERT INTO log (computer_id, status)
        VALUES (?, ?);
    `;

	const values = [id, "offline"];

	await db.query(sql, values);
	db.end();
}

module.exports = {
	addToPending,
	amIConnected,
	recieveInfo,
	amIPending,
	iGiveYouYourInfo,
	logOnline,
	logOffline,
};
