//事件监听
var EventEmitter = require('events').EventEmitter; 

redis = require('redis-eventemitter');
pubsub = redis({
	port: 6370,
	host: '127.0.0.1',
});
//事件监听

//房间逻辑
var rooms = [];
var roomsid = [];
function destoryroom(the_room){
    let this_index = roomsid.indexOf(the_room.room_id);
    rooms[this_index] = null;
    roomsid[this_index] = null;
    rooms.splice(this_index);//这个可能不一定需要
    roomsid.splice(this_index);//这个可能不一定需要 因为我不太知道那个删除元素的逻辑
    console.log('test room still there' + rooms[this_index] + 'test room id still there' + roomsid[this_index]);
}

//监听逻辑
pubsub.on("room_request",function(channel, user){
    //第一次房间列表和房间都是空的，这两个数组的操作是同步的按道理
    if(!roomsid.includes(user.room_id)){//如果找不到房间
        roomsid.push(user.room_id);//把它加入到目前的房间列表
        rooms.push(new MyRoom(user.room_id,user.player_amount));//new一个房间对象，把房间名，和玩家数量丢进去初始化
        rooms[rooms.length-1].ready(user);//然后添加第一个用户，就是发起申请的那个用户
        console.log('新建了一个房间' + roomsid[roomsid.length-1]);
    }   //有一个逻辑要记住如果房间号一样 人数不同 以一开始的那个为准，保证唯一值
    else{
        //如果房间号已经存在了,那就添加一个新用户，给这个房间，
        // 当房间就绪之后ready会callback一个开始游戏，然后就自动开启了
        rooms[roomsid.indexOf(user.room_id)].ready(user);
    }
    console.log(channel);//房间生成请求
    //最后返回一条成功的信息。
});

pubsub.on('update_room_msg',function(channel, user){//这个是接收单个玩家
    if(rooms[roomsid.indexOf(user.room_id)]!=null){
        if(rooms[roomsid.indexOf(user.room_id)].gamestart == true&&rooms[roomsid.indexOf(user.room_id)].gameover==false){
            console.log(channel);
            var roomindex = roomsid.indexOf(user.room_id);
            var playerindex = rooms[roomindex].playersid.indexOf(user.unique_id);
            //这里修改了一下 应该是找那个玩家 但是这里留空了我不知道有啥用
            console.log('received player'+user.player_id+user.unique_id);
            rooms[roomsid.indexOf(user.room_id)].updatemessage(user);

        }
    }
})


class MyRoom extends EventEmitter{

    constructor(room_id,player_amount){
        super();//继承类要加super
        this.room_id = room_id;//这里应该和socketio的房间id保持一致
        this.player_amount = player_amount;
        this.gameover = false;//符合胜利条件才算
        this.gamestart = false;//凑够4个或指定数量的玩家才算 最少要2个 看connection状态或者在游戏里面给一个ready的状态吧
        this.init_hp = 10000;//这个是初始生命值
        this.current_unit_pollution = 0;
        this.players = [];//这个用于储存所有的player类
        this.playersid = [];
        this.starttime = 10*60*1000;//这个单位到时候再想，看看是分钟还是秒。
        this.moneyrank = [];
        this.dingshiqi;//这个定时器其实没啥用 但是为了停止他我也只能这样了
    }
  
    ready(data){
        //这里看看怎么写 应该就是等待redigs事件 
        //先这么写吧 把外部事件都交给redis。内部事件交给eventemit
        //到时候再额外写一个callback 但是目前来看逻辑没问题
        if(this.gameover!=true){
            if(this.players.length==this.player_amount){
                console.log('有个沙雕满人都要硬加');
                pubsub.emit('room_respon', 'enough players');//这个后面在修改吧
            }
            else{
                pubsub.emit('room_respon', 'add one players');
                
                this.playersid.push(data.unique_id);//这个是索引，为了找索引
                this.players.push(new player(data.player_id));//这个是player的数据
                this.moneyrank.push({player_name:data.player_id,money:this.players[this.playersid.indexOf(data.unique_id)].money});
                //rank还要搞一搞
                console.log('添加了一个');
                console.log(this.players[this.playersid.indexOf(data.unique_id)].player_name);
                if(this.players.length==this.player_amount){//满足人数马上开始
                    // this.emit('game_start'); //这么写好像没必要
                    this.init();
                }
            }
        }
    }
    
    init(){//这里init的意思应该是开始游戏的意思，不是我们常规意义的初始化
        // this.on('game_start',function(){
            this.gamestart = true;
            console.log(this);
            console.log(this.room_id + ' is running');
            this.updatestatus();
            this.hanlde_gameend();//在开始游戏之后 就要开始监听是否有游戏结束事件了
            // });
        }
        
    hanlde_gameend(){//这里emit的内容应该和updatestauts的内容一样
        this.once('game_end',function(){//只监听一次 然后结束所有事件 销毁这个房间
            console.log(this.room_id + 'is end');
            
            if(this.init_hp<=0){
                pubsub.emit('update_room_status',{room_id:this.room_id,game_status:'all lose!',hp:this.init_hp,moneyrank:this.moneyrank});
                
            }
            if(this.starttime<=0){
                pubsub.emit('update_room_status',{room_id:this.room_id,game_status:'some one win!',hp:this.init_hp,moneyrank:this.moneyrank});
                
            }
            
            
            setTimeout(() => {//10秒销毁好像安全一点
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
        
        // console.log(this.players[index].player_name+this.players[index].factory);
        
        
    }
    
    updatestatus(){
       this.dingshiqi = setInterval(() => {
            console.log('test interval still there');
            
            if(this.gameover==false){
                this.caculate_unit_pollution();
                this.caculate_total_pollution();
                this.caculate_money();
                if(this.init_hp<=0){//用event.on来监听 保证即时响应 这里只做状态修改同时直接break出去
                    this.emit('game_end');
                    this.gameover = true;//这个感觉没什么用了 因为有了事件 但是还是加上吧
                    clearInterval(this.dingshiqi); //写在这里而不是handle是因为 handleend是异步 这里会多触发一次 虽然我觉得应该不会的
                }
                this.starttime-=1000;
                if(this.starttime<=0){//同上，当计算完生命没有归0，就计算是否到时间
                    this.emit('game_end');
                    this.gameover = true;
                    clearInterval(this.dingshiqi);
                }
                pubsub.emit('update_room_status',{room_id:this.room_id,game_status:'running',hp:this.init_hp,moneyrank:this.moneyrank});
                //这里是每次更新完状态要发送信息过去 让主服务器根据房间id进行处理。
            }
        }, 1000);
    }
    
    caculate_money(){//这里要写一个排序 以后可以再写一个污染的排序吧
        for(player in this.players){
        //    var tempindex = this.playersid.indexOf(this.players[player]);//不用这么麻烦
           this.moneyrank[player].money = this.players[player].money;  
        }
        //计算每个玩家的金币数 但是这个应该是接受来自事件的 到时候看看 一些是外部用的方法一些是内部用的方法
    }
    
    caculate_total_pollution(){
        //把这个设置为定时运行。因为我要想一下怎么把玩家的参数传递进去。
        this.init_hp-=this.current_unit_pollution;
        console.log('this current hp is ' + this.init_hp);
    }
    
    caculate_unit_pollution(){
        for(player in this.players){
            for(factory in this.players[player].factories){
                this.current_unit_pollution += this.players[player].factories[factory];
                console.log('current room unit pollution is ' + this.current_unit_pollution);
            }
        }
        
    }
    }
    
class player{
    constructor(player_name){
        this.player_name = player_name;
        this.money = 100;//初始金钱100
        this.factories = [];//这个是建筑对象存数据用的 可能就直接给数据就可以？目前只有单位污染
        // this.factoriesid = [];//这个是索引，找工厂用的
    }
}

class factory{//这个可能不需要用的到了 因为如果只是单位污染的话没啥用
    constructor(unit_pollution){
        this.unit_pollution = unit_pollution;
    }
}

pubsub.on('fortest',function(){
    console.log('hear');
})
    
// setInterval(() => {
//     console.log(rooms);
// }, 10000);






