var EventEmitter = require('events').EventEmitter; 
var events = require('events');
var eventEmitter = new events.EventEmitter();
const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const port = process.env.PORT||3000;
const server = app.listen(port,function(){
    console.log('listen on req to port ' + port);
});
//—————————————————————————————————————————————————————————————— socket io part
socketio = require('socket.io');
io = socketio(server);
//—————————————————————————————————————————————————————————————— socket io part
//—————————————————————————————————————————————————————————————— express part
app.use(bodyParser()); 
//static file
app.use(express.static(__dirname+'/public'));

app.get('/homepage',function(req,res){
    res.sendFile(__dirname+'/index.html');
})
//—————————————————————————————————————————————————————————————— express part
//主要逻辑部分
var rooms = [];
var roomsid = [];

// {roomname:'haha',
//  playername:[{player1:'name1'},
    // {player2:'name2'},
    // {player3:'name3'},
    // {player3:'name3'}],
    // roomstatus:'running or waiting'};


io.on('connect', function (socket) {
    console.log( socket.id+'连上了服务器!');//socketid也要存，作为用户名唯一的处理
    socket.on('room_req',function(data){ //这里还要重新做一个重新连接的情况 不过影响不是很大
        //在客户端转到游戏页面并连接成功后，客户端会马上发送房间请求，
        // 附带的信息正是一开始homepage发送的房间信息
        console.log(socket.id + '发来了房间请求 信息如下');
        if(roomsid.includes(data.room_id)){
        console.log(data);
        //在获取了唯一id之后 再向房间添加玩家
        rooms[roomsid.indexOf(data.room_id)].ready(data);
        socket.join(data.room_id);
    }
        else{
            console.log(socket.id + '请求的房间不存在');
        }
        });
    socket.on('msg_from_client',function(data){ //这里处理以下来自房间的信息
        if(roomsid.includes(data.room_id)){
            let thisroom = rooms[roomsid.indexOf(data.room_id)];
            if(thisroom.gamestart==true&&thisroom.gameover==false){
            //游戏进行中 同时没有gameover 因为游戏结束后游戏开始是true 或者说gameover等于false的时候gamestart是true的情况
                thisroom.updatemessage(data);
                console.log(data);
                console.log('received player message'+data.unique_id);
            }
        }
    })
}); 

app.post('/gamepage',function(req,res){ 
    //step1这里是带表单发送一大堆信息过来给我 
    console.log('gamepage request');
    var room_message = req.body;//这里包含了人数 玩家名 房间信息
    var playernum  = parseInt(room_message.player_amount);//字符串转换成int
    room_message.player_amount = playernum;//转换回去
    console.log(room_message);
    //step2房间信息的处理
    if(!roomsid.includes(room_message.room_id)){
        //如果没有这个名字的房间
        roomsid.push(room_message.room_id);
        let room_name = room_message.room_id;
        let amount = room_message.player_amount;
        let newmyroom = new MyRoom(room_name,amount);
        rooms.push(newmyroom);
        res.render(__dirname+'/gamepage.ejs',{data:room_message}); 
        //这个带参的游戏页面用于在新游戏页面客户端发起socketio请求;
    }
    else{
        var thismyroom = rooms[roomsid.indexOf(room_message.room_id)];
        if(thismyroom.gamestart==true){
            res.send('已经有同名房间在游戏中，请更换游戏房间名');
             
        }
        else{
            console.log('ceshi');
            console.log(thismyroom);
            res.render(__dirname+'/gamepage.ejs',{data:room_message}); 
            //这个带参的游戏页面用于在新游戏页面客户端发起socketio请求;
        }
    }
});






var debug = false;


///////////////////////////////////////////////////////////////////

if(debug){//把这个转换成静态方法把
    setInterval(() => {
        console.log(rooms);
    }, 10000);
}

class MyRoom extends EventEmitter{//继承了事件监听器类
    constructor(room_id,player_amount){
        super();//继承类要加super
        this.room_id = room_id;//这里应该和socketio的房间id保持一致
        this.player_amount = player_amount;
        this.gameover = false;//符合胜利条件才算
        this.gamestart = false;//凑够4个或指定数量的玩家才算 最少要2个 看connection状态或者在游戏里面给一个ready的状态吧
        this.init_hp = 500*player_amount;//这个是初始生命值
        this.current_unit_pollution = 0;
        this.players = [];//这个用于储存所有的player类
        this.playersid = [];
        this.starttime = 10*60*1000;//这个单位到时候再想，看看是分钟还是秒。
        this.moneyrank = [];
        this.dingshiqi;//这个定时器是为了结束后停用这个定时器 是一些函数封装的问题 具体忘记了 但是把定时器写在类里面必须通过变量来赋值
    }
  
    ready(data){
        if(this.gameover!=true){//这个条件约束好像没什么用 但是逻辑的确是这样
            if(this.players.length==this.player_amount){
                console.log('有个沙雕满人都要硬加');
            }//这个部分不太需要了 因为是上面的function在处理这个事件
            else{
                console.log('添加了一个新的玩家');
                this.playersid.push(data.unique_id);//唯一id用于辨识同名的情况 
                let newplayer = new myPlayer(data.player_id,data.unique_id);
                this.players.push(newplayer);//这个是player的数据
                this.moneyrank.push({player_name:newplayer.player_id,money:newplayer.money,unique_id:newplayer.unique_id});
                console.log(newplayer);
                
                
                if(this.players.length==this.player_amount){//满足人数就开始
                    setTimeout(() => {//为了满足最后一个玩家也能接收到开始的命令这里做一个延迟发送
                        var initmsg = {room_id:this.room_id,game_status:'start',hp:this.init_hp,moneyrank:this.moneyrank,time_left:this.starttime};
                        console.log('init'+initmsg);
                        io.to(this.room_id).emit('gamestatus',initmsg);//直接发送房间信息到各个客户端 游戏开始了
                    }, 1000);
                    setTimeout(() => {//这里实际上是3秒 第一秒结束后玩家接收到信息后然后321开始
                        this.init();
                    }, 4000);
                    
                }
            }
        }
    }
    
    init(){//这里init的意思应该是开始游戏的意思，不是我们常规意义的初始化
            this.gamestart = true;
            console.log(this.room_id + ' is running');
            this.updatestatus();
            this.hanlde_gameend();//在开始游戏之后 就要开始监听是否有游戏结束事件了
        }
        
    hanlde_gameend(){//这里emit的内容应该和updatestauts的内容一样
        this.once('game_end',function(){//只监听一次 然后结束所有事件 销毁这个房间
            console.log(this.room_id + 'is end');
            
            if(this.init_hp<=0){
                var status = {room_id:this.room_id,game_status:'all lose!',hp:this.init_hp,moneyrank:this.moneyrank,time_left:this.starttime};
                io.to(this.room_id).emit('gamestatus',status);
            }
            if(this.starttime<=0){
                var status = {room_id:this.room_id,game_status:'some one win!',hp:this.init_hp,moneyrank:this.moneyrank,time_left:this.starttime};
                io.to(this.room_id).emit('gamestatus',status);
                
            }
            
            
            setTimeout(() => {//10秒后销毁安全一点 其实也不太需要了 直接删也可以
                destoryroom(this);
                
            }, 10000);

        })

    }

    updatemessage(data){//这个单个玩家发过来的
        //数据格式应该是
        // {player_id : 'xxx',money:'100',factory:[0,1,1],unique_id:'xasdkfenn'}
        //可以让每次玩家都一次过把完整的建筑列表发送过来也可以
        // players = ['小明','小红','tom','haha'];
        var index = this.playersid.indexOf(data.unique_id);//这里要找唯一id怕出现重名
        this.players[index].money = data.money;
        this.players[index].factories = data.factory;
        
    }
    
    updatestatus(){
       this.dingshiqi = setInterval(() => {
            // console.log('test interval still there');
            
            if(this.gameover==false){
                this.caculate_unit_pollution();
                this.caculate_total_pollution();
                this.caculate_money();
                if(this.init_hp<=0){//用event.on来监听 保证即时响应 这里只做状态修改同时直接break出去
                    this.emit('game_end');
                    this.gameover = true;//这个感觉没什么用了 因为有了事件 但是还是加上吧
                    clearInterval(this.dingshiqi); //写在这里而不是handle是因为 handleend是异步 这里会多触发一次
                }
                this.starttime-=1000;
                if(this.starttime<=0){//同上，当计算完生命没有归0，就计算是否到时间
                    this.emit('game_end');
                    this.gameover = true;
                    clearInterval(this.dingshiqi);
                }
                var updated_room_message = {room_id:this.room_id,game_status:'running',hp:this.init_hp,moneyrank:this.moneyrank,time_left:this.starttime};
                if(debug){
                    console.log('我发送了一个');
                    console.log(updated_room_message);
                }
                io.to(this.room_id).emit('update_room_status',updated_room_message);
                //这里是每次更新完状态要发送信息过去
            }
        }, 1000);
    }
    
    caculate_money(){//这里要写一个排序 以后可以再写一个污染的排序吧
        for(var player in this.players){
        //    var tempindex = this.playersid.indexOf(this.players[player]);//不用这么麻烦
           this.moneyrank[player].money = this.players[player].money;  
        }
        //计算每个玩家的金币数 但是这个应该是接受来自事件的 到时候看看 一些是外部用的方法一些是内部用的方法
    }
    
    caculate_total_pollution(){
        //把这个设置为定时运行。因为我要想一下怎么把玩家的参数传递进去。
        this.init_hp-=this.current_unit_pollution;
        if(debug){
            console.log('this current hp is ' + this.init_hp);
        }
    }
    
    caculate_unit_pollution(){
        this.current_unit_pollution = 0;
        for(var player in this.players){
            for(var factory in this.players[player].factories){
                this.current_unit_pollution += this.players[player].factories[factory];
                if(debug){
                    console.log('current room unit pollution is ' + this.current_unit_pollution);
                }
                
            }
        }
        
    }
    }
    
class myPlayer{
    constructor(player_id,unique_id){
        this.unique_id = unique_id;
        this.player_id = player_id;
        this.money = 100;//初始金钱100
        this.factories = [];//这个是建筑对象存数据用的 可能就直接给数据就可以？目前只有单位污染
        // this.factoriesid = [];//这个是索引，找工厂用的
    }
}

// class factory{//这个可能不需要用的到了 因为如果只是单位污染的话没啥用
//     constructor(unit_pollution){
//         this.unit_pollution = unit_pollution;
//     }
// }




function destoryroom(the_room){
    let this_index = roomsid.indexOf(the_room.room_id);
    rooms[this_index] = null;
    roomsid[this_index] = null;
    rooms.splice(this_index);//这个可能不一定需要
    roomsid.splice(this_index);//这个可能不一定需要 因为我不太知道那个删除元素的逻辑
    // console.log('test room still there' + rooms[this_index] + 'test room id still there' + roomsid[this_index]);
}

///////////////////////////////////////////////////////////////////







