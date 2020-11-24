//目前进度还差排名 看看是写在前端还是后端 还有名字的问题
const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const port = 3000;
const server = app.listen(port,function(){
    console.log('listen on req to port ' + port);
});
//—————————————————————————————————————————————————————————————— socket io part
socketio = require('socket.io');
io = socketio(server);
//—————————————————————————————————————————————————————————————— socket io part
//—————————————————————————————————————————————————————————————— redis
const redis = require('redis-eventemitter'); 
pubsub = redis({
	port: 6370,
	host: '127.0.0.1',
});
//—————————————————————————————————————————————————————————————— redis
//—————————————————————————————————————————————————————————————— express part
app.use(bodyParser()); 
//static file
app.use(express.static('public'));

app.get('/homepage',function(req,res){
    res.sendFile(__dirname+'/index.html');
})
//—————————————————————————————————————————————————————————————— express part
//主要逻辑部分
var roomid = [];//用于检索
var rooms = [];//下面是单个元素的格式

// {roomname:'haha',
//  playername:[{player1:'name1'},
    // {player2:'name2'},
    // {player3:'name3'},
    // {player3:'name3'}],
    // roomstatus:'running or waiting'};

//这里处理来自gamepage页面的scoketio请求
app.post('/gamepage',function(req,res){ 
    console.log('gamepage request');//这个用于debug

    
    var room_message = req.body;//这里包含了人数 玩家名 房间信息
    var playernum  = parseInt(room_message.player_amount);
    room_message.player_amount = playernum;
    // 来自homepage表单填写的player_id room_id player_amount 三个字段
    console.log(room_message);
    if(!roomid.includes(room_message.room_id)){//检索是否之前已经有人用过这个房间名字了
    // 如果没有的话：
    roomid.push(room_message.room_id);//这个储存到roomsid用于索引编号
    //临时对象 房间名 房间状态 房间人数 玩家名的信息
    var tempobj = {room_id:room_message.room_id,player:[room_message.player_id],room_status:'wait for start',player_amount:room_message.player_amount};

    rooms.push(tempobj);//添加到房间对象信息用于检索状态 和上面的房间id不一样 这里是用于以后检索游戏是否开始的
    
    res.render(__dirname+'/ejstest.ejs',{data:room_message}); 
    //同时渲染游戏页面，因为没有房间信息，所以认为这是一个新房间了
    //这个带参的游戏页面用于在新游戏页面客户端发起socketio请求到我方服务器，以便让服务端的socketio安排房间
    }
    else{//否则，如果这个房间存在的话
        if(rooms[roomid.indexOf(room_message.room_id)].room_status=='wait for start'){
            //先检索这个房间是否已经开始 这里不做判断两个人同时想到一个房间名 所以如果有恰巧那就是命运了

            res.render(__dirname+'/ejstest.ejs',{data:room_message});//同样的生成房间信息页面给它 同样是人数 玩家名 房间名

        }
        else {//如果你有重名同时这个房间在开始运行，那就不好意思了。至于房间运行状态由对战服务器来更新服务端的room状态来做判断
            res.send('已经有同名房间在游戏中，请更换游戏房间名！');//如果是这个房间在运行说明它来晚了
        }

    }
     
});
pubsub.on('sha',function(channel,user){
    console.log(channel);
    console.log(user);
})
//这个部分是处理游戏页面发生的io事件，上面是homepage到gamepage之间的准备步骤，这里才正式建立和客户端的长链接
io.on('connect', function (socket) {
    console.log( socket.id+'连上了服务器!');//socketid也要存，作为用户名唯一的处理

    socket.on('room_req',function(data){//在客户端转到游戏页面并连接成功后，客户端会马上发送房间请求，附带的信息正是一开始homepage发送的房间信息
        //为了保险起见，来一个二次验证吧
        console.log(socket.id + '发来了房间请求');
        data.unique_id = socket.id;
        console.log(data);
        pubsub.emit('room_request',data);//向对战服务器发送创建房间请求，此时才是第一次真正与对战服务器构建逻辑
        socket.join(data.room_id);
        console.log('发送了一个' + data.room_id + '到对战服务器');
        //把这个socket加入到房间，后面io会在对战服务器更新信息之后广播到这个房间。
        });

    socket.on('room_battle_message_update',function(data){
        pubsub.emit('update_room_msg',data);
        //这里是不是说我直接就可以发了?

    })
}); 
setInterval(() => {
    pubsub.emit('fortest','hha');
    console.log('?');
}, 1000);
//这个部分是对战服务器会在所有的已经开始游戏的对战房间中定时发送房间信息更新事件的处理
pubsub.on('update_room_status',function(channel, user){
    //当监听到来自对战服务器更新的事件时（按道理这里可能会有一秒同时好几个或者怎么样的）
    console.log('battle_sever_update_room_message');
    console.log(user);
    rooms[roomid.indexOf(user.room_id)].room_status = user.game_status;
    io.to(user.room_id).emit('battle message update',user);
    //因为我们上面在客户连接io的时候已经发送了房间请求，所以已经加入了某个房间
    //所以这里我们根据对战服务器给我们的房间名广播到socketio指定的房间中。
});


