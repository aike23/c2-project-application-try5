const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

const port = 1337;

const indexRoutes = require("./routes/routes.js")(io);

const modules = require("./src/modules.js");

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(indexRoutes);

const downloadDirectory = path.join(__dirname, "download");
if (!fs.existsSync(downloadDirectory)) {
	fs.mkdirSync(downloadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, downloadDir);
	},
	filename: function (req, file, cb) {
		cb(null, file.originalname);
	},
});

const upload = multer({ storage: storage });

//?
//? PUT EVERY SOCKET EMIT FUNCTIONAILITY IN THIS ONE
//?
io.on("connection", (socket) => {
	socket.on("beat", () => {
		console.log("recived beat");
		socket.emit("server_status", { status: "online" });
	});

	socket.on("sendUUID", (data) => {
		console.log(data);
		console.log("UUID recieved");
		socket.emit("success", {
			message: "Server: 'UUID recived sucessfully'",
		});
	});

	socket.on("ATW", async (data) => {
		console.log("client ATW");

		socket.emit("ATW_rec", { message: "atw-recieved" });

		try {
			const result = await modules.addToPending(data.uuid);
			// console.log(result[1][0].result);

			if (result[1][0].result === "Request already sent") {
				socket.emit("ATW_res", { message: "Request already sent" });
			} else {
				socket.emit("ATW_res", { message: "Success. Request Pending" });
			}
		} catch (err) {
			console.error("Error", err);
		}
	});

	socket.on("Am I Connected?", async (id) => {
		const result = await modules.amIConnected(id.uuid);

		// console.log(result);

		if (result === "yes") {
			socket.emit("You are:", { message: "yes" });
		} else {
			socket.emit("You are:", { message: "no" });
		}
	});

	socket.on("Am I Pending?", async (id) => {
		const result = await modules.amIPending(id.uuid);

		if (result === "yes") {
			socket.emit("You areP:", { message: "yes" });
		} else {
			socket.emit("You areP:", { message: "no" });
		}
	});

	socket.on("My Information:", async (data) => {

		await modules.recieveInfo(data);
	});

	socket.on("Give My Information", async (data) => {
		const result = await modules.iGiveYouYourInfo(data.uuid);

		socket.emit("Heres Your Info", result);
	});

	socket.on("Sending File", (file) => {
		const filePath = path.join(downloadDirectory, file.name);
		fs.writeFile(filePath, file.data, (err) => {
			if (err) {
				console.error("Error saving file:", err);
				socket.emit("fileError", {
					message: "File could not be saved.",
				});
			} else {
				console.log("File saved:", file.name);
				socket.emit("fileReceived", {
					message: "File saved successfully.",
				});
			}
		});
	});

	socket.on("I AM ONLINE", async (data) => {
		await modules.logOnline(data.uuid);
	});

	socket.on("I AM OFFLINE", async (data) => {
		await modules.logOffline(data.uuid);
	});
});

app.post("/upload", upload.single("file"), (req, res) => {
	const filePath = path.join(downloadDirectory, req.file.originalname);
	io.emit("file-upload", {
		fileName: req.file.originalname,
		filePath: filePath,
	});
	res.send("File uploaded successfully.");
});

httpServer.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
