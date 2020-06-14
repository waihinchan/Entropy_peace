// var arr = [1,2,3,4,5];
// console.log(arr.indexOf(6));
// console.log(arr[arr.length-1]);

//这个部分测试事件是不是独立的
var EventEmitter = require('events').EventEmitter; 
class eventtest extends EventEmitter{
    constructor(name,endtime){
        super();
        this.name = name;
        this.endtime = endtime;
    }
    handle_end(){
        this.on('end',function(){console.log(this.name + 'end')});
        clearInterval(this.dingshiqi);
    }
    emitend(){
        setTimeout(() => {
            this.emit('end');
            
        }, this.endtime);
    }
    dingshiqi(){
        console.log('测试你是否还在');
    }
    

}
// var event1 = new eventtest('1号',10000);
// var event2 = new eventtest('2号',5000);
// var event3 = new eventtest('3号',10000);
// var event4 = new eventtest('4号',15000);
// event1.handle_end();
// event2.handle_end();
// event3.handle_end();
// event4.handle_end();
// event1.emitend();
// event2.emitend();
// event3.emitend();
// event4.emitend();
// event1.dingshiqi();
//独立事件测试成功，证明event的事件是单独独立开的。
// var a = new eventtest('a',10);
// var b = new eventtest('b',10);
// var c = new eventtest('c',10);
// var d = [a,b,c];
// console.log(d[1]);

// var str='string';
// var _script='var '+ str +' =123;';
// eval(_script);
// console.log(typeof string);//number
// console.log(string);//123
// string=456;
// console.log(string);//456

// var factorys = [1,2,3,4,5,6];
// var arra = {'factory':factorys};
// console.log(arra.factory);
// var a = [];
// var b =function(){console.log(a.length);}
// var d = setInterval(() => {
//     console.log(a.length);
// }, 1000);
// setTimeout(() => {
//     clearInterval(d);
// }, 5000);
// var room = [];
// var roomsid = [];
// var testroomname = 'nihaoma';
// var player1name = 'wohenhao';
// var player2name = 'wobuhao';
// var player3name = 'wohaodehen';
// var player4name = 'woyibanhao';
// var tempobj = {roomname:'nihaoma',playername:[player1name]};
// room.push(tempobj);
// roomsid.push(testroomname);
// console.log(room[roomsid.indexOf(testroomname)].playername.push(player2name));
// console.log(room);
