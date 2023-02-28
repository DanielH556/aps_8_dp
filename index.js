var app = require('http').createServer(resposta);
var fs = require('fs');
var io = require('socket.io')(app);
const sqlite3 = require('sqlite3').verbose();

app.listen(3000);
console.log("Aplicação está em execução...");

function resposta (req, res) {
     var arquivo = "";
     if(req.url == "/"){
         arquivo = __dirname + '/index.html';
     }else{
         arquivo = __dirname + req.url;
     }
     fs.readFile(arquivo,
         function (err, data) {
              if (err) {
                   res.writeHead(404);
                   return res.end('Página ou arquivo não encontrados');
              }

              res.writeHead(200);
              res.end(data);
         }
     );
}

function pegarDataAtual(){
    var dataAtual = new Date();
    var dia = (dataAtual.getDate()<10 ? '0' : '') + dataAtual.getDate();
    var mes = ((dataAtual.getMonth() + 1)<10 ? '0' : '') + (dataAtual.getMonth() + 1);
    var ano = dataAtual.getFullYear();
    var hora = (dataAtual.getHours()<10 ? '0' : '') + dataAtual.getHours();
    var minuto = (dataAtual.getMinutes()<10 ? '0' : '') + dataAtual.getMinutes();
    var segundo = (dataAtual.getSeconds()<10 ? '0' : '') + dataAtual.getSeconds();

    var dataFormatada = dia + "/" + mes + "/" + ano + " " + hora + ":" + minuto + ":" + segundo;
    return dataFormatada;
    }

function armazenarMensagem(mensagem){
    if(ultimas_mensagens.length > 5){
        ultimas_mensagens.shift();
    }
    ultimas_mensagens.push(mensagem)
}

//Database Management
// Create connection
const db = new sqlite3.Database('markers.db');

// Create table "Marcadores"
db.serialize(function() {
   db.run("CREATE TABLE IF NOT EXISTS Marcadores (id INTEGER PRIMARY KEY AUTOINCREMENT, latitude FLOAT, longitude FLOAT)");
   console.log("Banco de dados criado com sucesso!");
});

function setMarker(latlng) {
   db.run("INSERT INTO Marcadores (latitude, longitude) VALUES (" + latlng[0] + ", " + latlng[1] + ")");
   console.log('Marcador foi salvo com sucesso!')
};

let marcadores = {}
let i = 0
async function selectMarkers() {
   // FIXME: Banco repete SELECT cada vez que usuário entra na sala, trazendo um objeto gigante repetindo os marcadores
   await db.all("SELECT * FROM Marcadores", function(err, rows) {
      rows.forEach(function(row) {
         console.log(row.id + ": " + row.latitude + " | " + row.longitude)
         let marcador = Object.assign(marcadores, { 
            [i]: {
               id: row.id,
               latitude: row.latitude,
               longitude: row.longitude
            }
          });
         i++;
      });
   });
   console.log("Todos os marcadores foram retornados!")
}

var usuarios = [];
var ultimas_mensagens = []

io.on("connection", function(socket){
    socket.on("entrar", function(apelido, callback){
        if(!(apelido in usuarios)){
            socket.apelido = apelido;
            usuarios[apelido] = socket;
    
            io.sockets.emit("atualizar usuarios", Object.keys(usuarios));
            io.sockets.emit("atualizar mensagens", "[ " + pegarDataAtual() + " ] " + apelido + " acabou de entrar na sala");
    
            callback(true);
        }else{
            callback(false);
        }
    });

     socket.on("enviar mensagem", function(mensagem_enviada, callback){
        mensagem_enviada = "[ " + pegarDataAtual() + " ] " + socket.apelido + " diz: " + mensagem_enviada;
        io.sockets.emit("atualizar mensagens", mensagem_enviada);
        callback();
     });

     socket.on("desconectar", function(){
        delete usuarios[socket.apelido];
        var mensagem = " [ " + pegarDataAtual() + " ] " + socket.apelido + " saiu da sala";
        var obj_mensagem = {msg: mensagem, tipo: 'sistema'};

        io.sockets.emit("atualizar usuarios", Object.keys(usuarios));
        io.sokets.emit("atualizar mensagens", obj_mensagem);

        armazenarMensagem(obj_mensagem);
     });

     socket.on("salvar marcador", function(latlng, callback) {
      setMarker(latlng);
      socket.emit("Marcador salvo com sucesso!")
     });

     socket.on("mostrar marcadores", function() {
      selectMarkers();
      io.sockets.emit("mostrar marcadores retorno", marcadores);
      console.log("socket emit executed!")
     })
});
