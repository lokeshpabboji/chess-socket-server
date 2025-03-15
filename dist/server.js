"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const chess_js_1 = require("chess.js");
const port = process.env.PORT;
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "https://tactix-two.vercel.app",
        methods: ["GET", "POST"],
        credentials: true,
    }
});
const games = {};
io.on("connection", (socket) => {
    console.log(`user is connected ${socket.id}`);
    socket.on("disconnect", (reason) => {
        console.log(`User disconnected. Socket ID: ${socket.id}, Reason: ${reason}`);
        for (const roomId in games) {
            const room = io.sockets.adapter.rooms.get(roomId);
            if (!room || room.size === 0) {
                delete games[roomId];
                console.log(`Room ${roomId} deleted.`);
            }
        }
    });
    socket.on("joinGame", (roomId) => {
        var _a;
        if (((_a = io.sockets.adapter.rooms.get(roomId)) === null || _a === void 0 ? void 0 : _a.size) === 2) {
            socket.emit('error', { message: "Room is full" });
            return;
        }
        socket.join(roomId);
        console.log(`user with id ${socket.id} joined the room ${roomId}`);
        if (!games[roomId]) {
            games[roomId] = {
                game: new chess_js_1.Chess(),
                players: [socket.id]
            };
        }
        else {
            games[roomId].players.push(socket.id);
        }
        const playerIndex = games[roomId].players.indexOf(socket.id);
        socket.emit("playerColor", playerIndex === 0 ? "white" : "black");
        socket.emit("gameState", { pgn: games[roomId].game.pgn(), fen: games[roomId].game.fen() });
    });
    socket.on("move", (data) => {
        const { roomId, from, to, promotion } = data;
        const gameData = games[roomId];
        if (!gameData) {
            socket.emit("error", { message: "No game found." });
            return;
        }
        const { game, players } = gameData;
        const playerIndex = players.indexOf(socket.id);
        if ((game.turn() === "w" && playerIndex !== 0) || (game.turn() === "b" && playerIndex !== 1)) {
            socket.emit("error", { message: "Not your turn." });
            return;
        }
        const move = game.move({ from, to, promotion });
        if (move == null) {
            socket.emit("InvalidMove", { message: "Invalid move" });
            return;
        }
        if (game.isGameOver()) {
            let result = "Draw";
            if (game.isCheckmate()) {
                result = game.turn() === "w" ? "Black wins by checkmate!" : "White wins by checkmate!";
            }
            else if (game.isStalemate()) {
                result = "Stalemate!";
            }
            else if (game.isThreefoldRepetition()) {
                result = "Draw by threefold repetition!";
            }
            else if (game.isInsufficientMaterial()) {
                result = "Draw due to insufficient material!";
            }
            io.to(roomId).emit("gameOver", result);
        }
        io.to(roomId).emit("gameState", { pgn: game.pgn(), fen: game.fen() });
    });
});
server.listen(port, () => {
    console.log("server is listening on port 4000");
});
