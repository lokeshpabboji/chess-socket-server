import express, { Request, Response } from "express"
import { Server } from "socket.io";
import { createServer } from "http";
import { Chess } from "chess.js";

const port = process.env.PORT;

const app = express();
const server = createServer(app)
const io = new Server(server, {
    cors : {
        origin : "https://tactix-two.vercel.app/",
        methods : ["GET", "POST"],
        credentials : true,
    }
})

const games : {[roomId : string] : {game : Chess, players : string[]}} = {}

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

    socket.on("joinGame", (roomId : string) => {

        if(io.sockets.adapter.rooms.get(roomId)?.size === 2){
            socket.emit('error', {message : "Room is full"})
            return;
        }

        socket.join(roomId)
        console.log(`user with id ${socket.id} joined the room ${roomId}`);

        if(!games[roomId]){
            games[roomId] = {
                game : new Chess(),
                players : [socket.id]
            }
        }else {
            games[roomId].players.push(socket.id)
        }

        const playerIndex = games[roomId].players.indexOf(socket.id);
        socket.emit("playerColor", playerIndex === 0 ? "white" : "black");
        socket.emit("gameState", {pgn : games[roomId].game.pgn(), fen : games[roomId].game.fen()})
    })

    socket.on("move", (data : {roomId : string, from : string, to : string, promotion ?: string}) => {
        const {roomId, from, to, promotion} = data;
        const gameData = games[roomId];
        if(!gameData){
            socket.emit("error", {message : "No game found."})
            return;
        }
        const {game, players} = gameData;

        const playerIndex = players.indexOf(socket.id);

        if ((game.turn() === "w" && playerIndex !== 0) || (game.turn() === "b" && playerIndex !== 1)) {
            socket.emit("error", { message: "Not your turn." });
            return;
        }

        const move = game.move({from, to, promotion})
        if(move == null){
            socket.emit("InvalidMove", {message : "Invalid move"})
            return;
        }
        if (game.isGameOver()) {
            let result = "Draw";
            if (game.isCheckmate()) {
                result = game.turn() === "w" ? "Black wins by checkmate!" : "White wins by checkmate!";
            } else if (game.isStalemate()) {
                result = "Stalemate!";
            } else if (game.isThreefoldRepetition()) {
                result = "Draw by threefold repetition!";
            } else if (game.isInsufficientMaterial()) {
                result = "Draw due to insufficient material!";
            }

            io.to(roomId).emit("gameOver", result );
        }
        io.to(roomId).emit("gameState", {pgn : game.pgn(), fen : game.fen()});
    })

})

server.listen(port, () => {
    console.log("server is listening on port 4000")
})