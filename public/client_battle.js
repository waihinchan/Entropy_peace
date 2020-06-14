
// const socket = io.connect('http://localhost:3000');

// socket.on('connect',function(){
//     console.log('connected to the sever');
//     send_room_req(result);
//     // console.log(typeof(result.player_amount));
//     result.unique_id = socket.id;
//     console.log(result);
// });
    
// socket.on('battle message update',function(data){
//     console.log(data);
//     severmsg = data;
//     console.log(severmsg);
//     if(severmsg.game_status==true){
//         gamestart == true;
//     }
//     //这里到时候要处理的 先这样吧
// })
// function send_room_req(init_room_message){//这个函数是在连接到socketio之后马上把房间号信息发送到服务器
//     socket.emit('room_req',init_room_message);
// }

